"use server";

import type { ConversationStatus, MessageType, Priority } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { convertLeadToOpportunity } from "@/features/leads/actions";
import {
  getAtendimentoAutomationSettings,
  isPastAfterHoursCutoff,
  isSameCalendarDay,
} from "@/features/atendimento-automation/settings";
import {
  findMatchingContacts,
  findOrCreateContactForLead,
  resolveContactForCompany,
} from "@/features/atendimento/contact-resolution";
import { MESSAGE_TYPE_LABELS } from "@/features/atendimento/labels";
import {
  CONVERSATION_PARTICIPANT_IDS,
  canEditConversation,
  getAtendimentoViewer,
  isAttendingConversation,
} from "@/features/atendimento/permissions";
import { createCustomer } from "@/features/customers/actions";
import { getDefaultProviderName, getMessageProvider } from "@/features/atendimento/providers/registry";
import {
  getConversationListSignature,
  getConversationMessages,
  searchContactsForConversation,
  searchCustomersForLinking,
} from "@/features/atendimento/queries";
import {
  createConversationSchema,
  createOpportunityFromConversationSchema,
  sendMessageSchema,
  startConversationFromEntitySchema,
  transferConversationSchema,
  type CreateConversationInput,
  type CreateOpportunityFromConversationInput,
  type StartConversationFromEntityInput,
  type TransferConversationInput,
} from "@/features/atendimento/schema";

type ActionResult<T = undefined> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string };

export type AtendimentoEntityType = "LEAD" | "OPPORTUNITY" | "SALE" | "INSTALLATION" | "CUSTOMER_CONTACT";

export type ResolveConversationResult =
  | { type: "active"; conversationId: string; contactId: string }
  | {
      type: "ready";
      contact: { id: string; name: string; role: string | null };
      companyName: string | null;
      customerId: string | null;
      leadId: string | null;
      opportunityId: string | null;
    }
  | { type: "candidates"; candidates: { id: string; name: string; role: string | null; companyName: string | null }[] }
  | { type: "error"; message: string };

async function requireAtendimentoSession() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "atendimento")) {
    return null;
  }
  // `viewer` carrega a permissão "Ver atendimento de todos" (overrides do
  // usuário) — é o que as regras de canEditConversation usam.
  const viewer = await getAtendimentoViewer(session.user);
  return Object.assign(session, { viewer });
}

function previewOf(content: string): string {
  return content.length > 140 ? `${content.slice(0, 140)}…` : content;
}

// Notificações do Atendimento (sininho): só o que é pessoal — fui
// mencionado numa nota, fui adicionado como participante, uma conversa foi
// passada pra mim. Conversa nova na fila e mensagem nova NÃO notificam
// (pedido do usuário). Nunca derruba a ação principal se falhar.
async function notifyAtendimento(
  userId: string,
  actorId: string,
  conversationId: string,
  title: string,
  message: string
): Promise<void> {
  if (userId === actorId) return;
  try {
    await createNotification({ userId, title, message, link: `/atendimento/${conversationId}` });
  } catch (error) {
    console.error("Falha ao criar notificação do Atendimento", error);
  }
}

async function contactNameOf(conversationId: string): Promise<string> {
  const row = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contact: { select: { name: true } } },
  });
  return row?.contact.name ?? "um contato";
}

function revalidateAtendimento(conversationId?: string) {
  revalidatePath("/atendimento");
  if (conversationId) revalidatePath(`/atendimento/${conversationId}`);
}

// "Nova conversa" (seção 8/25) — é a porta de entrada manual de um
// atendimento nesta etapa (não existe webhook real ainda, seção 2).
// Reaproveita ou cria um Contact (nunca duplica — mesmo princípio de dedupe
// de convertLeadToOpportunity), depois cria a Conversation + 1ª mensagem.
export async function createConversation(
  input: CreateConversationInput
): Promise<ActionResult<{ conversationId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para criar atendimentos." };
  }

  const parsed = createConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;
  const providerName = await getDefaultProviderName();

  try {
    const conversationId = await prisma.$transaction(async (tx) => {
      let contact = data.contactId
        ? await tx.contact.findUnique({ where: { id: data.contactId } })
        : null;

      if (!contact) {
        const phone = onlyDigits(data.phone ?? "");
        const whatsapp = data.whatsapp ? onlyDigits(data.whatsapp) : null;
        contact = await tx.contact.findFirst({
          where: { deletedAt: null, OR: [{ phone }, ...(whatsapp ? [{ whatsapp }] : [])] },
        });

        if (!contact) {
          contact = await tx.contact.create({
            data: {
              name: data.name ?? phone,
              phone,
              whatsapp,
              origin: "WHATSAPP",
              responsibleId: session.user.id,
            },
          });
        }
      }

      const conversation = await tx.conversation.create({
        data: {
          contactId: contact.id,
          priority: data.priority,
          assigneeId: session.user.id,
          status: "OPEN",
          provider: providerName,
          lastMessageAt: new Date(),
          lastMessagePreview: previewOf(data.content),
        },
      });

      await logActivity(
        {
          userId: session.user.id,
          action: "conversation.started",
          entityType: "Conversation",
          entityId: conversation.id,
          metadata: { contactId: contact.id },
        },
        tx
      );

      // Mensagem INBOUND aqui é o atendente registrando algo que o cliente
      // já mandou (por telefone, por exemplo) — não é enviada por nós, não
      // passa pelo provider. OUTBOUND é enviada de verdade logo abaixo,
      // fora da transação (reaproveita sendMessage, que já sabe falar com
      // o provider certo).
      if (data.direction === "INBOUND") {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            direction: "INBOUND",
            type: "TEXT",
            content: data.content,
            status: "DELIVERED",
          },
        });
      }

      return conversation.id;
    });

    if (data.direction === "OUTBOUND") {
      const sendResult = await sendMessage(conversationId, { content: data.content });
      if (!sendResult.success) {
        // A conversa já foi criada — não desfaz; o atendente reenvia de
        // dentro dela (mesmo princípio de startConversationFromEntity).
        revalidateAtendimento(conversationId);
        return { success: true, data: { conversationId } };
      }
    }

    revalidateAtendimento(conversationId);
    return { success: true, data: { conversationId } };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Não foi possível criar a conversa. Tente novamente." };
  }
}

// Entrada de mensagem recebida (seção 20: papel que um webhook real ocupará
// no futuro — hoje só é usado internamente, não há rota pública chamando
// isto ainda). Sempre soma unreadCount; quem cria conversa manualmente pela
// Central usa createConversation acima, não esta função.
//
// Identificação automática (seção 4-7 do adendo): 1 match de telefone/
// WhatsApp usa o contato normalmente; 0 ou >1 matches nunca são escolhidos
// arbitrariamente — cria/usa um contato "sombra" (identified:false) pro
// atendente resolver dentro da própria conversa (contact-resolution.ts).
export async function receiveInboundMessage(params: {
  phone: string;
  name?: string;
  content: string;
  channelIdentifier?: string | null;
  type?: MessageType;
  mediaUrl?: string | null;
  // Idempotência (seção 24 do adendo): um provider real pode reenviar o
  // mesmo evento (retry de webhook) — nunca duplica a Message se o mesmo
  // providerMessageId já existe.
  providerMessageId?: string | null;
  // Provider por onde a mensagem chegou de verdade (cada webhook sabe o
  // seu) — sem isso, cai no provider ativo em Configurações > Integrações.
  provider?: string;
}): Promise<ActionResult<{ conversationId: string; messageId: string; isNewConversation: boolean }>> {
  const phone = onlyDigits(params.phone);
  if (!phone) return { success: false, error: "Telefone inválido." };

  if (params.providerMessageId) {
    const existing = await prisma.message.findUnique({
      where: { providerMessageId: params.providerMessageId },
      select: { id: true, conversationId: true },
    });
    if (existing) {
      return {
        success: true,
        data: { conversationId: existing.conversationId, messageId: existing.id, isNewConversation: false },
      };
    }
  }

  const providerName = params.provider ?? (await getDefaultProviderName());
  const whatsappName = params.name?.trim() || null;

  try {
    const matches = await findMatchingContacts(phone);
    const singleMatch = matches.length === 1 ? matches[0] : null;

    const result = await prisma.$transaction(async (tx) => {
      let contact = singleMatch;

      if (!contact) {
        // 0 ou >1 matches: contato-sombra, sem empresa — ambiguidade/ausência
        // fica visível pro atendente resolver (identified:false), nunca
        // decidida sozinha pelo sistema.
        contact = await tx.contact.create({
          data: {
            name: whatsappName || phone,
            whatsappName,
            phone,
            origin: "WHATSAPP",
            identified: false,
          },
          include: { company: { include: { customer: { select: { id: true, status: true } } } } },
        });
      } else if (whatsappName && whatsappName !== contact.whatsappName) {
        // Nome do perfil do WhatsApp mudou (ou chegou pela 1ª vez): guarda o
        // novo, e o nome do contato só acompanha se ainda não foi renomeado
        // no CRM — ou seja, se ainda é o nome antigo do WhatsApp ou o número.
        const followsWhatsapp =
          contact.name === contact.whatsappName || onlyDigits(contact.name) === onlyDigits(phone);
        contact = await tx.contact.update({
          where: { id: contact.id },
          data: { whatsappName, ...(followsWhatsapp ? { name: whatsappName } : {}) },
          include: { company: { include: { customer: { select: { id: true, status: true } } } } },
        });
      }

      let conversation = await tx.conversation.findFirst({
        where: { contactId: contact.id, status: { notIn: ["RESOLVED", "CLOSED"] } },
        orderBy: { createdAt: "desc" },
      });

      const isNewConversation = !conversation;
      const customerId = contact.company?.customer?.id ?? null;

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            contactId: contact.id,
            customerId,
            status: "OPEN",
            provider: providerName,
            channelIdentifier: params.channelIdentifier ?? null,
            lastMessageAt: new Date(),
            lastMessagePreview: previewOf(params.content),
            unreadCount: 1,
          },
        });
        await logActivity(
          {
            action: "conversation.started",
            entityType: "Conversation",
            entityId: conversation.id,
            metadata: { contactId: contact.id },
          },
          tx
        );
      } else {
        conversation = await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: previewOf(params.content),
            unreadCount: { increment: 1 },
            status: conversation.status === "WAITING_CUSTOMER" ? "OPEN" : conversation.status,
            customerId: conversation.customerId ?? customerId,
            // Resposta sai pelo mesmo canal por onde o cliente escreveu por
            // último (ex.: trocou de Neonize pra API oficial no meio).
            provider: providerName,
          },
        });
      }

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          direction: "INBOUND",
          type: params.type ?? "TEXT",
          content: params.content,
          mediaUrl: params.mediaUrl ?? null,
          status: "DELIVERED",
          provider: providerName,
          providerMessageId: params.providerMessageId ?? null,
        },
      });

      return { conversationId: conversation.id, messageId: message.id, isNewConversation };
    });

    // Mensagens automáticas (Configurações > Mensagens automáticas) — depois
    // da transação, igual ao envio OUTBOUND de createConversation logo
    // acima (chamada ao provider real não deveria segurar a transação).
    const automation = await getAtendimentoAutomationSettings();

    if (result.isNewConversation && automation.welcomeMessage.enabled && automation.welcomeMessage.text) {
      await sendAutomaticMessage(result.conversationId, automation.welcomeMessage.text);
    }

    if (
      automation.afterHours.enabled &&
      automation.afterHours.text &&
      isPastAfterHoursCutoff(automation.afterHours.time)
    ) {
      const current = await prisma.conversation.findUnique({
        where: { id: result.conversationId },
        select: { lastAfterHoursNoticeAt: true },
      });
      const alreadyNotifiedToday =
        current?.lastAfterHoursNoticeAt && isSameCalendarDay(current.lastAfterHoursNoticeAt, new Date());
      if (!alreadyNotifiedToday) {
        await sendAutomaticMessage(result.conversationId, automation.afterHours.text);
        await prisma.conversation.update({
          where: { id: result.conversationId },
          data: { lastAfterHoursNoticeAt: new Date() },
        });
      }
    }

    revalidateAtendimento(result.conversationId);
    return { success: true, data: result };
  } catch (error) {
    console.error(error);
    return { success: false, error: "Não foi possível registrar a mensagem recebida." };
  }
}

// Monta o contexto de citação pro provider real conseguir mandar uma
// resposta que o WhatsApp do cliente mostra de verdade como "respondendo a:
// ..." (não só uma citação visual dentro do CRM) — precisa do
// providerMessageId da mensagem original e de quem a mandou (participant).
// Sem providerMessageId (mensagem antiga, mandada antes do provider real, ou
// pelo provider manual) não dá pra montar isso — a resposta ainda assim sai,
// só sem o quote nativo do WhatsApp.
async function buildQuotedContext(
  replyToId: string | undefined,
  conversationId: string,
  contactPhone: string,
  channelIdentifier: string | null
): Promise<{ replyToId: string | null; quoted: { providerMessageId: string; participant: string; content: string } | null }> {
  if (!replyToId) return { replyToId: null, quoted: null };

  const quotedMessage = await prisma.message.findFirst({
    // Nota interna nunca pode ser citada numa mensagem ao cliente.
    where: { id: replyToId, conversationId, internal: false },
    select: { id: true, providerMessageId: true, direction: true, content: true, type: true },
  });
  if (!quotedMessage) return { replyToId: null, quoted: null };
  if (!quotedMessage.providerMessageId) return { replyToId: quotedMessage.id, quoted: null };

  return {
    replyToId: quotedMessage.id,
    quoted: {
      providerMessageId: quotedMessage.providerMessageId,
      // Citação outbound (nossa mensagem anterior) foi "enviada" pelo nosso
      // próprio número; citação inbound veio do contato.
      participant: quotedMessage.direction === "INBOUND" ? contactPhone : (channelIdentifier ?? contactPhone),
      content: quotedMessage.type === "TEXT" ? quotedMessage.content : MESSAGE_TYPE_LABELS[quotedMessage.type],
    },
  };
}

// Mensagem enviada pelo próprio sistema, não por um atendente específico —
// boas-vindas, encerramento e fora-do-horário (Configurações > Mensagens
// automáticas). Mesmo caminho de sendMessage (provider real + Message +
// atualização da conversa), só sem o prefixo com nome de quem atende
// (não tem "quem" aqui) e sem exigir assigneeId/conversa aberta (dispara
// em momentos em que essas condições podem nem valer ainda, como a
// primeira mensagem de um contato novo, sem ninguém atribuído).
async function sendAutomaticMessage(conversationId: string, text: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: { select: { phone: true, whatsapp: true } } },
  });
  if (!conversation) return;

  const to = conversation.contact.phone ?? conversation.contact.whatsapp;
  if (!to) return;

  const provider = getMessageProvider(conversation.provider);
  const sendResult = await provider.sendMessage({
    conversationId,
    to,
    channelIdentifier: conversation.channelIdentifier,
    content: text,
    type: "TEXT",
  });

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: text,
      status: sendResult.status,
      provider: conversation.provider,
      providerMessageId: sendResult.providerMessageId,
      senderUserId: null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: message.createdAt,
      lastMessagePreview: previewOf(text),
      status:
        conversation.status === "OPEN" || conversation.status === "WAITING_INTERNAL"
          ? "WAITING_CUSTOMER"
          : conversation.status,
    },
  });
}

// Resposta do atendente (seção 11). Passa pelo MessageProvider (seção 20) em
// vez de gravar direto no banco — é o ponto de troca quando um provider real
// entrar. Responder também transiciona o status para "aguardando cliente"
// automaticamente: acabamos de responder, a bola passa a estar com o cliente.
export async function sendMessage(
  conversationId: string,
  input: { content: string; replyToId?: string }
): Promise<ActionResult<{ messageId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para responder atendimentos." };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...CONVERSATION_PARTICIPANT_IDS, contact: { select: { phone: true, whatsapp: true } } },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para responder esta conversa." };
  }
  if (conversation.status === "CLOSED") {
    return { success: false, error: "Esta conversa está encerrada. Reabra para continuar respondendo." };
  }
  if (!conversation.assigneeId) {
    return { success: false, error: "Inicie o atendimento antes de responder." };
  }

  const to = conversation.contact.phone ?? conversation.contact.whatsapp;
  if (!to) {
    return { success: false, error: "Este contato não tem telefone cadastrado." };
  }

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Só aceita citar mensagem da própria conversa — evita vazar conteúdo de
  // outro atendimento via um replyToId adivinhado.
  const { replyToId, quoted } = await buildQuotedContext(
    parsed.data.replyToId,
    conversationId,
    to,
    conversation.channelIdentifier
  );

  const provider = getMessageProvider(conversation.provider);
  // O nome de quem está atendendo aparece pro cliente no WhatsApp (não só
  // dentro do CRM) — o texto que sai é prefixado com o nome; o que fica
  // salvo no banco continua limpo, porque a bolha do CRM já mostra o nome
  // do remetente separado (message-bubble.tsx).
  const outgoingContent = `${session.user.name}:\n\n${parsed.data.content}`;
  const sendResult = await provider.sendMessage({
    conversationId,
    to,
    channelIdentifier: conversation.channelIdentifier,
    content: outgoingContent,
    type: "TEXT",
    quoted,
  });

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: parsed.data.content,
      replyToId,
      status: sendResult.status,
      provider: conversation.provider,
      providerMessageId: sendResult.providerMessageId,
      senderUserId: session.user.id,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: message.createdAt,
      lastMessagePreview: previewOf(parsed.data.content),
      status:
        conversation.status === "OPEN" || conversation.status === "WAITING_INTERNAL"
          ? "WAITING_CUSTOMER"
          : conversation.status,
    },
  });

  // Respondeu = leu: avisa o WhatsApp do cliente também.
  await sendReadReceipts(conversationId);
  revalidateAtendimento(conversationId);
  return {
    success: true,
    data: { messageId: message.id },
    // Mensagem chega a ser gravada (aparece na conversa com o ícone de
    // falha), mas sem isto o atendente só percebe que não chegou de
    // verdade ao WhatsApp do cliente se reparar no ícone — fácil de passar
    // batido (queixa: "mensagem não está sendo enviada" sem erro visível).
    warning: sendResult.status === "FAILED" ? "A mensagem não chegou ao WhatsApp do cliente. Tente reenviar." : undefined,
  };
}

const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // limite do próprio WhatsApp pra foto/vídeo/áudio
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024; // limite do WhatsApp pra documento

// Qualquer arquivo aceito pelo WhatsApp: foto/vídeo viram mídia; áudio só
// vira "mensagem de voz" quando é gravação do microfone (voiceNote) — um
// arquivo de áudio anexado (MP3 etc.) vai como documento, porque o envio de
// áudio do whatsapp-service é sempre como voz (ptt). O resto é documento.
function classifyMediaType(mimetype: string, voiceNote: boolean): MessageType {
  if (mimetype.startsWith("image/")) return "IMAGE";
  if (mimetype.startsWith("video/")) return "VIDEO";
  if (mimetype.startsWith("audio/") && voiceNote) return "AUDIO";
  return "DOCUMENT";
}

// Envio de foto/vídeo/áudio/documento (seção "prepare pra receber vídeos,
// fotos e áudios" — agora enviando também). Mesmas regras de sendMessage
// (responsável, conversa aberta, etc.), só muda o que vai pro provider.
export async function sendMediaMessage(
  conversationId: string,
  formData: FormData
): Promise<ActionResult<{ messageId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para responder atendimentos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Nenhum arquivo selecionado." };
  }
  const voiceNote = formData.get("voiceNote") === "1";
  const type = classifyMediaType(file.type, voiceNote);
  if (type === "DOCUMENT" ? file.size > MAX_DOCUMENT_BYTES : file.size > MAX_MEDIA_BYTES) {
    return {
      success: false,
      error: type === "DOCUMENT" ? "Arquivo muito grande (máximo 100 MB)." : "Arquivo muito grande (máximo 16 MB).",
    };
  }
  const caption = String(formData.get("caption") ?? "").trim();
  const replyToId = formData.get("replyToId");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...CONVERSATION_PARTICIPANT_IDS, contact: { select: { phone: true, whatsapp: true } } },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para responder esta conversa." };
  }
  if (conversation.status === "CLOSED") {
    return { success: false, error: "Esta conversa está encerrada. Reabra para continuar respondendo." };
  }
  if (!conversation.assigneeId) {
    return { success: false, error: "Inicie o atendimento antes de responder." };
  }

  const to = conversation.contact.phone ?? conversation.contact.whatsapp;
  if (!to) {
    return { success: false, error: "Este contato não tem telefone cadastrado." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { replyToId: linkedReplyToId, quoted } = await buildQuotedContext(
    typeof replyToId === "string" ? replyToId : undefined,
    conversationId,
    to,
    conversation.channelIdentifier
  );

  const provider = getMessageProvider(conversation.provider);
  const outgoingCaption = caption ? `${session.user.name}:\n\n${caption}` : undefined;
  const sendResult = await provider.sendMessage({
    conversationId,
    to,
    channelIdentifier: conversation.channelIdentifier,
    content: outgoingCaption ?? "",
    type,
    mediaFile: { buffer, filename: file.name, mimetype: file.type },
    quoted,
  });

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type,
      // Documento sem legenda guarda o nome do arquivo — é o que a bolha
      // mostra ao lado do link (a legenda que vai pro cliente continua só
      // a digitada).
      content: caption || (type === "DOCUMENT" ? file.name : ""),
      mediaUrl: sendResult.mediaUrl ?? null,
      replyToId: linkedReplyToId,
      status: sendResult.status,
      provider: conversation.provider,
      providerMessageId: sendResult.providerMessageId,
      senderUserId: session.user.id,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: message.createdAt,
      lastMessagePreview: caption ? previewOf(caption) : MESSAGE_TYPE_LABELS[type],
      status:
        conversation.status === "OPEN" || conversation.status === "WAITING_INTERNAL"
          ? "WAITING_CUSTOMER"
          : conversation.status,
    },
  });

  // Respondeu = leu: avisa o WhatsApp do cliente também.
  await sendReadReceipts(conversationId);
  revalidateAtendimento(conversationId);
  return {
    success: true,
    data: { messageId: message.id },
    warning: sendResult.status === "FAILED" ? "O arquivo não chegou ao WhatsApp do cliente. Tente reenviar." : undefined,
  };
}

// Manda o "lido" pro WhatsApp do cliente (tiques azuis no celular dele e
// conversa sem o contador de não lidas no celular da empresa) — chamado ao
// abrir a conversa no CRM e ao responder. Mensagem recebida nasce como
// DELIVERED e vira READ aqui, então cada uma só é avisada uma vez. Nunca
// derruba a ação que chamou: falhou, tenta de novo na próxima vez.
async function sendReadReceipts(conversationId: string): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { provider: true, contact: { select: { phone: true, whatsapp: true } } },
    });
    const provider = conversation ? getMessageProvider(conversation.provider) : null;
    const to = conversation?.contact.whatsapp ?? conversation?.contact.phone;
    if (!provider?.markAsRead || !to) return;

    const pending = await prisma.message.findMany({
      where: {
        conversationId,
        direction: "INBOUND",
        status: "DELIVERED",
        providerMessageId: { not: null },
        // Só as recentes — evita mandar recibo de todo o histórico antigo
        // (de antes deste recurso existir) de uma vez na primeira abertura.
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, providerMessageId: true },
    });
    if (pending.length === 0) return;

    const ok = await provider.markAsRead({
      to,
      providerMessageIds: pending.map((m) => m.providerMessageId as string),
    });
    if (ok) {
      await prisma.message.updateMany({
        where: { id: { in: pending.map((m) => m.id) } },
        data: { status: "READ" },
      });
    }
  } catch (error) {
    console.error("sendReadReceipts falhou:", error);
  }
}

export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };

  await sendReadReceipts(conversationId);
  if (conversation.unreadCount === 0) return { success: true, data: undefined };

  await prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
  revalidatePath("/atendimento");
  return { success: true, data: undefined };
}

export async function assignConversation(
  conversationId: string,
  userId: string | null
): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: CONVERSATION_PARTICIPANT_IDS });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para reatribuir esta conversa." };
  }
  if (conversation.assigneeId === userId) return { success: true, data: undefined };

  const [fromUser, toUser] = await Promise.all([
    conversation.assigneeId
      ? prisma.user.findUnique({ where: { id: conversation.assigneeId }, select: { name: true } })
      : null,
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null,
  ]);

  await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { assigneeId: userId } }),
    // Quem vira responsável deixa de ser "participante" (não fica duplicado).
    ...(userId
      ? [prisma.conversationParticipant.deleteMany({ where: { conversationId, userId } })]
      : []),
  ]);

  await logActivity({
    userId: session.user.id,
    action: "conversation.assigned",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { fromName: fromUser?.name ?? null, toName: toUser?.name ?? null },
  });
  if (userId) {
    await notifyAtendimento(
      userId,
      session.user.id,
      conversationId,
      "Conversa atribuída a você",
      `${session.user.name} passou a conversa com ${await contactNameOf(conversationId)} para você.`
    );
  }

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

// Nota interna ("modo anônimo" do chat): grava na conversa, destacada, mas
// NUNCA passa pelo provider — não vai pro WhatsApp do cliente. Também não
// mexe em status, prévia nem ordem da lista (não é uma resposta ao cliente).
export async function addInternalNote(
  conversationId: string,
  rawContent: string,
  // Quem foi @mencionado (escolhido na lista ao digitar @). Recebe
  // notificação e, se ainda não atende a conversa, entra como participante
  // — senão não conseguiria abrir a conversa pelo aviso.
  mentionedUserIds: string[] = []
): Promise<ActionResult<{ messageId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const content = rawContent.trim();
  if (!content) return { success: false, error: "Escreva a nota antes de salvar." };
  if (content.length > 4000) return { success: false, error: "Nota muito longa (máximo 4000 caracteres)." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: CONVERSATION_PARTICIPANT_IDS,
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content,
      status: "SENT",
      provider: "internal",
      senderUserId: session.user.id,
      internal: true,
    },
  });

  const mentionIds = [...new Set(mentionedUserIds)].filter((id) => id !== session.user.id).slice(0, 20);
  if (mentionIds.length > 0) {
    const [users, contactName] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: mentionIds }, status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, role: true },
      }),
      contactNameOf(conversationId),
    ]);
    const preview = content.length > 120 ? `${content.slice(0, 117)}...` : content;
    for (const user of users) {
      if (!canAccessModule(user.role, "atendimento")) continue;
      if (conversation.assigneeId && !isAttendingConversation(user.id, conversation)) {
        await prisma.conversationParticipant.createMany({ data: [{ conversationId, userId: user.id }] }).catch(() => null);
        await logActivity({
          userId: session.user.id,
          action: "conversation.participant_added",
          entityType: "Conversation",
          entityId: conversationId,
          metadata: { name: user.name, self: false, viaMention: true },
        });
      }
      await notifyAtendimento(
        user.id,
        session.user.id,
        conversationId,
        `${session.user.name} mencionou você`,
        `Nota interna na conversa com ${contactName}: "${preview}"`
      );
    }
  }

  revalidateAtendimento(conversationId);
  return { success: true, data: { messageId: message.id } };
}

// "Participar": mais de um atendente na mesma conversa. Todos respondem ao
// cliente (cada mensagem leva o nome de quem mandou) e veem as notas
// internas. O responsável continua sendo um só (assigneeId).
async function loadConversationForParticipants(conversationId: string) {
  const session = await requireAtendimentoSession();
  if (!session) return { ok: false as const, error: "Você não tem permissão para esta ação." };
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: CONVERSATION_PARTICIPANT_IDS,
  });
  if (!conversation) return { ok: false as const, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { ok: false as const, error: "Você não tem permissão para esta conversa." };
  }
  if (conversation.status === "CLOSED" || conversation.status === "RESOLVED") {
    return { ok: false as const, error: "Esta conversa está encerrada." };
  }
  return { ok: true as const, session, conversation };
}

export async function addConversationParticipant(conversationId: string, userId: string): Promise<ActionResult> {
  const loaded = await loadConversationForParticipants(conversationId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { session, conversation } = loaded;

  if (!conversation.assigneeId) {
    return { success: false, error: "Inicie o atendimento antes de adicionar outro atendente." };
  }
  if (conversation.assigneeId === userId) return { success: false, error: "Esta pessoa já é a responsável." };
  if (conversation.participants.some((p) => p.userId === userId)) {
    return { success: false, error: "Esta pessoa já está participando." };
  }
  // Quem não atende a conversa só pode incluir a si mesmo ("Participar");
  // incluir outra pessoa é de quem já atende (ou de quem supervisiona).
  const isSelf = userId === session.user.id;
  const attending = isAttendingConversation(session.user.id, conversation);
  if (!isSelf && !attending && !session.viewer.viewAll) {
    return { success: false, error: "Só quem está atendendo pode adicionar outro atendente." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, status: true, role: true } });
  if (!user || user.status !== "ACTIVE" || !canAccessModule(user.role, "atendimento")) {
    return { success: false, error: "Esta pessoa não pode atender conversas." };
  }

  await prisma.conversationParticipant.create({ data: { conversationId, userId } });
  await logActivity({
    userId: session.user.id,
    action: "conversation.participant_added",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { name: user.name, self: isSelf },
  });
  if (!isSelf) {
    await notifyAtendimento(
      userId,
      session.user.id,
      conversationId,
      "Você foi adicionado a uma conversa",
      `${session.user.name} adicionou você à conversa com ${await contactNameOf(conversationId)}.`
    );
  }

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

export async function removeConversationParticipant(conversationId: string, userId: string): Promise<ActionResult> {
  const loaded = await loadConversationForParticipants(conversationId);
  if (!loaded.ok) return { success: false, error: loaded.error };
  const { session, conversation } = loaded;

  if (!conversation.participants.some((p) => p.userId === userId)) {
    return { success: false, error: "Esta pessoa não está participando." };
  }
  const isSelf = userId === session.user.id;
  if (!isSelf && conversation.assigneeId !== session.user.id && !session.viewer.viewAll) {
    return { success: false, error: "Só o responsável pode remover outro atendente." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  await prisma.conversationParticipant.deleteMany({ where: { conversationId, userId } });
  await logActivity({
    userId: session.user.id,
    action: "conversation.participant_removed",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { name: user?.name ?? null, self: isSelf },
  });

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

export async function changeConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  // "Encerrar sem mensagem" (menu "...") — mesmo encerramento de sempre,
  // só pula o envio da mensagem automática de encerramento (Configurações >
  // Mensagens automáticas), pra quando o atendente já resolveu tudo por
  // fora ou o cliente já sabe que acabou, sem precisar desligar a
  // automação pra todo mundo só por causa desta conversa.
  options?: { skipAutomaticMessage?: boolean }
): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: CONVERSATION_PARTICIPANT_IDS });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }
  if (conversation.status === status) return { success: true, data: undefined };

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status,
      closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: status === "CLOSED" ? "conversation.closed" : "conversation.status_change",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { from: conversation.status, to: status },
  });

  if (status === "CLOSED" && !options?.skipAutomaticMessage) {
    const automation = await getAtendimentoAutomationSettings();
    if (automation.closingMessage.enabled && automation.closingMessage.text) {
      await sendAutomaticMessage(conversationId, automation.closingMessage.text);
    }
  }

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

export async function changeConversationPriority(
  conversationId: string,
  priority: Priority
): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: CONVERSATION_PARTICIPANT_IDS });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }
  if (conversation.priority === priority) return { success: true, data: undefined };

  await prisma.conversation.update({ where: { id: conversationId }, data: { priority } });

  await logActivity({
    userId: session.user.id,
    action: "conversation.priority_change",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { from: conversation.priority, to: priority },
  });

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

// "[+ Criar Lead]" (seção 6) e passo interno de createOpportunityFromConversation
// (seção 14) — extraído pra ser chamado sozinho (botão de resolução de
// contato desconhecido) ou como parte da criação de oportunidade, sem
// duplicar a lógica nos dois lugares.
export async function createLeadFromConversation(
  conversationId: string,
  ownerId?: string
): Promise<ActionResult<{ leadId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) {
    return { success: false, error: "Você não tem permissão para criar leads." };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...CONVERSATION_PARTICIPANT_IDS, contact: { include: { company: true } } },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }
  if (conversation.leadId) return { success: true, data: { leadId: conversation.leadId } };

  const contact = conversation.contact;
  const lead = await prisma.lead.create({
    data: {
      name: contact.name,
      phone: contact.phone || contact.whatsapp || "",
      whatsapp: contact.whatsapp,
      email: contact.email,
      companyName: contact.company?.legalName ?? null,
      companyCnpj: contact.company?.cnpj ?? null,
      origin: "WHATSAPP",
      responsibleId: ownerId ?? session.user.id,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "lead.create",
    entityType: "Lead",
    entityId: lead.id,
    metadata: { fromConversationId: conversationId },
  });

  await prisma.conversation.update({ where: { id: conversationId }, data: { leadId: lead.id } });

  revalidateAtendimento(conversationId);
  revalidatePath("/crm/leads");

  return { success: true, data: { leadId: lead.id } };
}

// "Criar oportunidade" pelo atendimento (seção 14). Reaproveita
// convertLeadToOpportunity (leads/actions.ts) — não duplica a lógica de
// dedupe/criação de Company/Contact/Opportunity. Só cria um Lead antes se a
// conversa ainda não tiver um (contato → lead → oportunidade, seção 25).
export async function createOpportunityFromConversation(
  conversationId: string,
  input: CreateOpportunityFromConversationInput
): Promise<ActionResult<{ opportunityId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session || !session.viewer.canCreateOpportunity) {
    return { success: false, error: "Você não tem permissão para criar oportunidades." };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      ...CONVERSATION_PARTICIPANT_IDS,
      contact: { include: { company: { include: { customer: { select: { id: true } } } } } },
    },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }
  if (conversation.opportunityId) {
    return { success: false, error: "Esta conversa já está vinculada a uma oportunidade." };
  }
  if (conversation.contact.company?.customer) {
    return { success: false, error: "A empresa deste contato já é cliente." };
  }

  const parsed = createOpportunityFromConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let leadId = conversation.leadId;

  if (!leadId) {
    const leadResult = await createLeadFromConversation(conversationId, parsed.data.ownerId);
    if (!leadResult.success) return leadResult;
    leadId = leadResult.data.leadId;
  }

  const result = await convertLeadToOpportunity(leadId, {
    title: parsed.data.title,
    stageId: parsed.data.stageId,
    priority: parsed.data.priority,
    estimatedValueCents: parsed.data.estimatedValueCents,
    ownerId: parsed.data.ownerId,
  });

  if (!result.success) return result;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { leadId, opportunityId: result.data.opportunityId },
  });

  await logActivity({
    userId: session.user.id,
    action: "conversation.opportunity_created",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { opportunityId: result.data.opportunityId, leadId },
  });

  revalidateAtendimento(conversationId);
  revalidatePath("/crm/leads");
  revalidatePath("/crm/oportunidades");
  revalidatePath("/crm/kanban");
  revalidatePath("/dashboard");

  return { success: true, data: { opportunityId: result.data.opportunityId } };
}

// "[+ Vincular a contato existente]" (seção 6) e resultado de
// ContactDisambiguationDialog — repointa a conversa pro contato certo. Se o
// contato antigo era um "contato-sombra" (identified:false) e não sobrou
// nenhuma outra referência a ele, apaga (nunca deixa lixo se não precisar).
export async function linkConversationToContact(
  conversationId: string,
  contactId: string
): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...CONVERSATION_PARTICIPANT_IDS, contact: { include: { company: { include: { customer: { select: { id: true } } } } } } },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }

  const newContact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { company: { include: { customer: { select: { id: true } } } } },
  });
  if (!newContact) return { success: false, error: "Contato não encontrado." };

  const oldContact = conversation.contact;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      contactId: newContact.id,
      customerId: conversation.customerId ?? newContact.company?.customer?.id ?? null,
    },
  });

  if (oldContact.id !== newContact.id && !oldContact.identified) {
    const otherRefs = await prisma.conversation.count({
      where: { contactId: oldContact.id, id: { not: conversationId } },
    });
    if (otherRefs === 0) {
      await prisma.contact.delete({ where: { id: oldContact.id } }).catch(() => {});
    }
  }

  await logActivity({
    userId: session.user.id,
    action: "conversation.contact_linked",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { contactId: newContact.id, contactName: newContact.name },
  });

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

// "[+ Vincular a cliente]" (seção 6) — vínculo manual direto quando o
// atendente sabe de qual empresa/cliente é, mas ainda não tem certeza de
// qual pessoa específica. Também aproveita pra ligar o contato-sombra à
// empresa do cliente (reusa Contact.companyId já existente), se o contato
// ainda não tinha empresa.
export async function linkConversationToCustomer(
  conversationId: string,
  customerId: string
): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...CONVERSATION_PARTICIPANT_IDS, contact: true },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { success: false, error: "Cliente não encontrado." };

  await prisma.conversation.update({ where: { id: conversationId }, data: { customerId } });

  if (customer.companyId && !conversation.contact.companyId) {
    await prisma.contact.update({
      where: { id: conversation.contact.id },
      data: { companyId: customer.companyId },
    });
  }

  await logActivity({
    userId: session.user.id,
    action: "conversation.customer_linked",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: { customerId },
  });

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

// Cadastro rápido (pedido do usuário: "vincular a cliente" precisa de um
// jeito de cadastrar na hora quando a busca não acha ninguém) — usa o
// próprio contato/empresa já identificados nesta conversa, sem pedir de
// novo. Reaproveita createCustomer (customers/actions.ts) em vez de duplicar
// a regra de "no máximo um Customer por Company/Contact".
export async function createCustomerForConversation(
  conversationId: string
): Promise<ActionResult<{ customerId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { ...CONVERSATION_PARTICIPANT_IDS, contact: { select: { id: true, companyId: true } } },
  });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }

  const created = await createCustomer({
    contactId: conversation.contact.id,
    companyId: conversation.contact.companyId ?? undefined,
  });
  if (!created.success) return created;

  const linked = await linkConversationToCustomer(conversationId, created.data.id);
  if (!linked.success) return linked;

  return { success: true, data: { customerId: created.data.id } };
}

// Transferência de fila/atendente (seções 15/16/19) — usada tanto pelo "já
// existe atendimento ativo" quanto por uma futura ação equivalente dentro do
// próprio chat. Fila e atendente mudam juntos num único evento auditável.
export async function transferConversation(
  conversationId: string,
  input: TransferConversationInput
): Promise<ActionResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: CONVERSATION_PARTICIPANT_IDS });
  if (!conversation) return { success: false, error: "Conversa não encontrada." };
  if (!canEditConversation(session.viewer, conversation)) {
    return { success: false, error: "Você não tem permissão para esta conversa." };
  }

  const parsed = transferConversationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const changesAssignee = parsed.data.assigneeMode !== undefined;
  const newAssigneeId = !changesAssignee
    ? conversation.assigneeId
    : parsed.data.assigneeMode === "unassigned"
      ? null
      : parsed.data.assigneeMode === "me"
        ? session.user.id
        : (parsed.data.assigneeUserId ?? null);

  const [fromUser, toUser] = await Promise.all([
    conversation.assigneeId
      ? prisma.user.findUnique({ where: { id: conversation.assigneeId }, select: { name: true } })
      : null,
    changesAssignee && newAssigneeId
      ? prisma.user.findUnique({ where: { id: newAssigneeId }, select: { name: true } })
      : null,
  ]);

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      queue: parsed.data.queue ?? conversation.queue,
      assigneeId: newAssigneeId,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "conversation.transferred",
    entityType: "Conversation",
    entityId: conversationId,
    metadata: {
      fromQueue: conversation.queue,
      toQueue: parsed.data.queue ?? conversation.queue,
      fromAssigneeName: fromUser?.name ?? null,
      toAssigneeName: changesAssignee ? (toUser?.name ?? null) : (fromUser?.name ?? null),
      reason: parsed.data.reason ?? null,
    },
  });
  if (changesAssignee && newAssigneeId && newAssigneeId !== conversation.assigneeId) {
    await notifyAtendimento(
      newAssigneeId,
      session.user.id,
      conversationId,
      "Conversa transferida para você",
      `${session.user.name} transferiu a conversa com ${await contactNameOf(conversationId)} para você.${
        parsed.data.reason ? ` Motivo: ${parsed.data.reason}` : ""
      }`
    );
  }

  revalidateAtendimento(conversationId);
  return { success: true, data: undefined };
}

// Resolve contato/cliente/lead/oportunidade a partir de onde o atendimento
// foi iniciado (seção 10-14). Leitura pura (sem criar Conversation) — exceto
// pro caso LEAD, onde encontrar-ou-criar o Contact é o mesmo passo
// determinístico que convertLeadToOpportunity já faz (não é ambíguo como um
// WhatsApp desconhecido chegando: aqui já sabemos exatamente quem é).
export async function resolveConversationForEntity(
  entityType: AtendimentoEntityType,
  entityId: string
): Promise<ResolveConversationResult> {
  const session = await requireAtendimentoSession();
  if (!session) return { type: "error", message: "Você não tem permissão para esta ação." };

  let contactId: string | null = null;
  let contactName: string | null = null;
  let contactRole: string | null = null;
  let companyName: string | null = null;
  let customerId: string | null = null;
  let leadId: string | null = null;
  let opportunityId: string | null = null;

  if (entityType === "LEAD") {
    const lead = await prisma.lead.findUnique({ where: { id: entityId } });
    if (!lead || lead.deletedAt) return { type: "error", message: "Lead não encontrado." };

    const contact = await findOrCreateContactForLead(lead);
    contactId = contact.id;
    contactName = contact.name;
    contactRole = contact.role;
    companyName = contact.company ? contact.company.tradeName || contact.company.legalName : lead.companyName;
    customerId = contact.company?.customer?.id ?? null;
    leadId = lead.id;
  } else if (entityType === "CUSTOMER_CONTACT") {
    const contact = await prisma.contact.findUnique({
      where: { id: entityId },
      include: { company: { include: { customer: { select: { id: true } } } } },
    });
    if (!contact) return { type: "error", message: "Contato não encontrado." };
    contactId = contact.id;
    contactName = contact.name;
    contactRole = contact.role;
    companyName = contact.company ? contact.company.tradeName || contact.company.legalName : null;
    customerId = contact.company?.customer?.id ?? null;
  } else {
    const include = {
      contact: { include: { company: { include: { customer: { select: { id: true } } } } } },
      company: { select: { id: true, legalName: true, tradeName: true } },
    } as const;

    const entity =
      entityType === "OPPORTUNITY"
        ? await prisma.opportunity.findUnique({ where: { id: entityId }, include })
        : entityType === "SALE"
          ? await prisma.sale.findUnique({ where: { id: entityId }, include })
          : await prisma.installation.findUnique({ where: { id: entityId }, include });

    if (!entity) return { type: "error", message: "Registro não encontrado." };

    opportunityId =
      entityType === "OPPORTUNITY" ? entityId : "opportunityId" in entity ? entity.opportunityId : null;
    customerId = "customerId" in entity ? entity.customerId : null;

    if (entity.contact) {
      contactId = entity.contact.id;
      contactName = entity.contact.name;
      contactRole = entity.contact.role;
      companyName = entity.company
        ? entity.company.tradeName || entity.company.legalName
        : entity.contact.company
          ? entity.contact.company.tradeName || entity.contact.company.legalName
          : null;
      customerId = customerId ?? entity.contact.company?.customer?.id ?? null;
    } else if (entity.companyId) {
      companyName = entity.company ? entity.company.tradeName || entity.company.legalName : null;
      const resolved = await resolveContactForCompany(entity.companyId);
      if (resolved.type === "candidates") {
        return {
          type: "candidates",
          candidates: resolved.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            companyName: c.company ? c.company.tradeName || c.company.legalName : null,
          })),
        };
      }
      if (resolved.type === "single") {
        const contact = await prisma.contact.findUnique({
          where: { id: resolved.contactId },
          include: { company: { include: { customer: { select: { id: true } } } } },
        });
        if (contact) {
          contactId = contact.id;
          contactName = contact.name;
          contactRole = contact.role;
          customerId = customerId ?? contact.company?.customer?.id ?? null;
        }
      }
    }
  }

  if (!contactId) {
    return {
      type: "error",
      message: "Não há contato ou empresa vinculada para iniciar o atendimento.",
    };
  }

  const active = await prisma.conversation.findFirst({
    where: { contactId, status: { notIn: ["RESOLVED", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (active) return { type: "active", conversationId: active.id, contactId };

  return {
    type: "ready",
    contact: { id: contactId, name: contactName ?? "—", role: contactRole },
    companyName,
    customerId,
    leadId,
    opportunityId,
  };
}

// "Iniciar atendimento" (seção 11/14) depois que resolveConversationForEntity
// devolveu "ready" — cria a Conversation já vinculada ao contexto de origem
// (Lead/Opportunity/Sale/Installation/Customer, seção 12) e, se houver
// mensagem inicial, reaproveita a mesma sendMessage já existente (não
// duplica a chamada ao MessageProvider).
export async function startConversationFromEntity(
  input: StartConversationFromEntityInput
): Promise<ActionResult<{ conversationId: string }>> {
  const session = await requireAtendimentoSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const parsed = startConversationFromEntitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const existingActive = await prisma.conversation.findFirst({
    where: { contactId: data.contactId, status: { notIn: ["RESOLVED", "CLOSED"] } },
    select: { id: true },
  });
  if (existingActive) {
    return {
      success: false,
      error: "Este contato já possui um atendimento em andamento.",
    };
  }

  const contact = await prisma.contact.findUnique({
    where: { id: data.contactId },
    include: { company: { include: { customer: { select: { id: true } } } } },
  });
  if (!contact) return { success: false, error: "Contato não encontrado." };

  let leadId: string | null = null;
  let opportunityId: string | null = null;
  let customerId: string | null = contact.company?.customer?.id ?? null;

  if (data.entityType === "LEAD") {
    leadId = data.entityId;
  } else if (data.entityType === "OPPORTUNITY") {
    opportunityId = data.entityId;
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: data.entityId },
      select: { sourceLeadId: true },
    });
    leadId = opportunity?.sourceLeadId ?? null;
  } else if (data.entityType === "SALE") {
    const sale = await prisma.sale.findUnique({
      where: { id: data.entityId },
      select: { opportunityId: true, customerId: true },
    });
    opportunityId = sale?.opportunityId ?? null;
    customerId = sale?.customerId ?? customerId;
  } else if (data.entityType === "INSTALLATION") {
    const installation = await prisma.installation.findUnique({
      where: { id: data.entityId },
      select: { opportunityId: true, customerId: true },
    });
    opportunityId = installation?.opportunityId ?? null;
    customerId = installation?.customerId ?? customerId;
  }

  const assigneeId =
    data.assigneeMode === "unassigned"
      ? null
      : data.assigneeMode === "me"
        ? session.user.id
        : (data.assigneeUserId ?? null);

  const conversation = await prisma.conversation.create({
    data: {
      contactId: contact.id,
      customerId,
      leadId,
      opportunityId,
      queue: data.queue ?? null,
      assigneeId,
      status: "OPEN",
      provider: await getDefaultProviderName(),
      lastMessageAt: new Date(),
      lastMessagePreview: data.initialMessage ? previewOf(data.initialMessage) : null,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "conversation.started",
    entityType: "Conversation",
    entityId: conversation.id,
    metadata: { contactId: contact.id, fromEntityType: data.entityType, fromEntityId: data.entityId },
  });

  if (data.initialMessage) {
    const sendResult = await sendMessage(conversation.id, { content: data.initialMessage });
    if (!sendResult.success) {
      // A conversa já foi criada; falha ao enviar a 1ª mensagem não deve
      // apagar o atendimento — o atendente tenta reenviar de dentro dele.
      revalidateAtendimento(conversation.id);
      return { success: true, data: { conversationId: conversation.id } };
    }
  }

  revalidateAtendimento(conversation.id);
  return { success: true, data: { conversationId: conversation.id } };
}

// Wrappers "use server" finos em cima de queries.ts (que não pode ser
// importado direto por componente client — toca o Prisma) — usados pelo
// polling do chat e pela busca de contato do diálogo "Nova conversa".
export async function fetchNewMessages(conversationId: string, afterId?: string) {
  const session = await requireAtendimentoSession();
  if (!session) return [];
  return getConversationMessages(conversationId, afterId);
}

// Usado pelo polling da lista de conversas (conversation-list.tsx) — troca
// um router.refresh() completo a cada 5s por essa checagem barata primeiro.
export async function fetchConversationListSignature(): Promise<string | null> {
  const session = await requireAtendimentoSession();
  if (!session) return null;
  return getConversationListSignature(session.viewer);
}

export async function searchContacts(q: string) {
  const session = await requireAtendimentoSession();
  if (!session) return [];
  return searchContactsForConversation(q);
}

export async function searchCustomers(q: string) {
  const session = await requireAtendimentoSession();
  if (!session) return [];
  return searchCustomersForLinking(q);
}

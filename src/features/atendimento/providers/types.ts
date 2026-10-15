import type { MessageStatus, MessageType } from "@prisma/client";

// Abstração de provider de mensagens (seção 20/21 do escopo da Fase 6).
// A UI e as actions da Central de Atendimento nunca falam com uma API de
// WhatsApp diretamente — sempre passam por aqui. Isso permite trocar/somar
// providers (ex: WhatsApp Cloud API, um número por departamento) sem
// reescrever a Central. Nesta etapa só existe o ManualMessageProvider
// (manual-provider.ts): não há nenhuma API real conectada ainda.
export type SendMessageInput = {
  conversationId: string;
  // Telefone de destino (do contato) — o provider manda a mensagem PRA cá.
  to: string;
  // Qual dos nossos números está enviando (seção 21: multi-WhatsApp futuro)
  // — null no provider manual, onde não existe "nosso número" nenhum.
  channelIdentifier: string | null;
  content: string;
  type: MessageType;
  // Presente quando o atendente anexa foto/vídeo/áudio/documento — ausente
  // numa mensagem só de texto.
  mediaFile?: { buffer: Buffer; filename: string; mimetype: string } | null;
  // Presente quando o atendente está respondendo a uma mensagem específica
  // (seção "Responder") — dados suficientes pra provider real (Neonize)
  // montar uma citação de verdade no WhatsApp do cliente.
  quoted?: { providerMessageId: string; participant: string; content: string } | null;
};

export type SendMessageResult = {
  status: MessageStatus;
  providerMessageId: string | null;
  // URL própria (hospedada pelo provider) do arquivo enviado — só quando
  // `mediaFile` foi passado. A bolha da mensagem usa essa URL, não uma do
  // WhatsApp (que pode exigir sessão pra acessar).
  mediaUrl?: string | null;
};

// Formato cru que um provider recebe de fora (payload de webhook). Não é
// consumido por nenhuma rota ainda — existe só para o formato de
// normalizeInbound já ficar definido para quando o webhook real existir.
export type InboundMessagePayload = Record<string, unknown>;

export type NormalizedInboundMessage = {
  channelIdentifier: string | null;
  fromPhone: string;
  fromName: string | null;
  content: string;
  type: MessageType;
  mediaUrl: string | null;
  providerMessageId: string | null;
};

export type MarkAsReadInput = {
  // Telefone do contato (quem mandou as mensagens).
  to: string;
  // providerMessageId das mensagens recebidas ainda não marcadas como lidas.
  providerMessageIds: string[];
};

export interface MessageProvider {
  name: string;
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  // Manda o "lido" (tiques azuis) pro WhatsApp do cliente — opcional: o
  // provider manual não tem WhatsApp nenhum pra avisar. true = deu certo.
  markAsRead?(input: MarkAsReadInput): Promise<boolean>;
  normalizeInbound(payload: InboundMessagePayload): NormalizedInboundMessage;
}

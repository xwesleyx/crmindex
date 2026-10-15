import { graphUrl, requireWhatsappCloudConfig } from "@/features/integrations/whatsapp-cloud-config";
import { stripBrazilCountryCode, withBrazilCountryCode } from "@/lib/validators";
import type {
  InboundMessagePayload,
  MarkAsReadInput,
  MessageProvider,
  NormalizedInboundMessage,
  SendMessageInput,
  SendMessageResult,
} from "@/features/atendimento/providers/types";
import type { MessageType } from "@prisma/client";

// Provider da API oficial do WhatsApp (WhatsApp Cloud API, da Meta) — fala
// direto com a Graph API, sem serviço intermediário (ao contrário do
// neonize, que depende do whatsapp-service/ rodando). Mídia recebida não é
// baixada pro nosso disco: a bolha aponta pra /api/whatsapp-cloud/media/<id>,
// que busca o arquivo na Meta na hora (com o token) — a Meta guarda a mídia
// por ~30 dias, depois disso o link para de carregar.
export function cloudMediaUrl(mediaId: string): string {
  return `/api/whatsapp-cloud/media/${encodeURIComponent(mediaId)}`;
}

// A Meta manda o "wa_id" de muitos celulares brasileiros antigos SEM o 9 na
// frente (DDD + 8 dígitos) — e o CRM grava celular com o 9 (DDD + 9
// dígitos). Sem isso, o mesmo cliente viraria um contato-sombra novo.
// Celular de 8 dígitos começa com 6-9; fixo (2-5) fica como está.
function withBrazilNinthDigit(phone: string): string {
  if (phone.length === 10 && /[6-9]/.test(phone[2])) return `${phone.slice(0, 2)}9${phone.slice(2)}`;
  return phone;
}

type GraphError ={ error?: { message?: string; code?: number } };

async function graphPost(path: string, accessToken: string, body: BodyInit, json = true): Promise<Response> {
  return fetch(graphUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });
}

const MEDIA_FIELD: Partial<Record<MessageType, "image" | "video" | "audio" | "document" | "sticker">> = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  STICKER: "sticker",
};

async function uploadMedia(
  file: NonNullable<SendMessageInput["mediaFile"]>,
  accessToken: string,
  phoneNumberId: string
): Promise<string> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", file.mimetype);
  form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.filename);

  const response = await graphPost(`${phoneNumberId}/media`, accessToken, form, false);
  const body = (await response.json()) as { id?: string } & GraphError;
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? `Upload de mídia falhou (${response.status}).`);
  }
  return body.id;
}

export const whatsappCloudProvider: MessageProvider = {
  name: "whatsapp_cloud",

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    try {
      const { accessToken, phoneNumberId } = await requireWhatsappCloudConfig();

      const message: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: withBrazilCountryCode(input.to),
      };
      if (input.quoted) message.context = { message_id: input.quoted.providerMessageId };

      let mediaId: string | null = null;
      const field = input.mediaFile ? MEDIA_FIELD[input.type] : undefined;

      if (input.mediaFile && field) {
        mediaId = await uploadMedia(input.mediaFile, accessToken, phoneNumberId);
        const media: Record<string, unknown> = { id: mediaId };
        // Áudio e figurinha não aceitam legenda na Cloud API.
        if (input.content && field !== "audio" && field !== "sticker") media.caption = input.content;
        if (field === "document") media.filename = input.mediaFile.filename;
        message.type = field;
        message[field] = media;
      } else {
        message.type = "text";
        message.text = { body: input.content, preview_url: true };
      }

      const response = await graphPost(`${phoneNumberId}/messages`, accessToken, JSON.stringify(message));
      const body = (await response.json()) as { messages?: { id: string }[] } & GraphError;

      if (!response.ok || !body.messages?.[0]?.id) {
        // 131047 = fora da janela de 24h (só dá pra mandar template aprovado).
        console.error("whatsappCloudProvider.sendMessage falhou:", body.error?.code, body.error?.message);
        return { status: "FAILED", providerMessageId: null, mediaUrl: mediaId ? cloudMediaUrl(mediaId) : null };
      }

      return {
        status: "SENT",
        providerMessageId: body.messages[0].id,
        mediaUrl: mediaId ? cloudMediaUrl(mediaId) : null,
      };
    } catch (error) {
      console.error("whatsappCloudProvider.sendMessage: erro ao chamar a Graph API", error);
      return { status: "FAILED", providerMessageId: null };
    }
  },

  // Na Cloud API, marcar a mensagem mais recente como lida marca também todas
  // as anteriores da conversa — basta uma chamada.
  async markAsRead(input: MarkAsReadInput): Promise<boolean> {
    const lastId = input.providerMessageIds.at(-1);
    if (!lastId) return true;
    try {
      const { accessToken, phoneNumberId } = await requireWhatsappCloudConfig();
      const response = await graphPost(
        `${phoneNumberId}/messages`,
        accessToken,
        JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: lastId })
      );
      return response.ok;
    } catch (error) {
      console.error("whatsappCloudProvider.markAsRead: erro ao chamar a Graph API", error);
      return false;
    }
  },

  // Recebe UMA mensagem já separada pelo webhook (/api/webhooks/whatsapp-cloud):
  // { message, contactName, phoneNumberId } — o webhook da Meta pode trazer
  // várias mensagens num único POST.
  normalizeInbound(payload: InboundMessagePayload): NormalizedInboundMessage {
    const message = (payload.message ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const kind = String(message.type ?? "text");

    let type: MessageType = "TEXT";
    let content = "";
    let mediaUrl: string | null = null;

    switch (kind) {
      case "text":
        content = message.text?.body ?? "";
        break;
      case "image":
      case "video":
      case "audio":
      case "document":
      case "sticker": {
        const media = message[kind] ?? {};
        type = kind.toUpperCase() as MessageType;
        content = media.caption ?? (kind === "document" ? (media.filename ?? "") : "");
        mediaUrl = media.id ? cloudMediaUrl(String(media.id)) : null;
        break;
      }
      case "location": {
        const loc = message.location ?? {};
        type = "LOCATION";
        const label = [loc.name, loc.address].filter(Boolean).join(" — ") || "Localização";
        content = `${label}\nhttps://maps.google.com/?q=${loc.latitude},${loc.longitude}`;
        break;
      }
      case "button":
        content = message.button?.text ?? "";
        break;
      case "interactive":
        content = message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "";
        break;
      case "contacts":
        content = `Contato compartilhado: ${message.contacts?.[0]?.name?.formatted_name ?? ""}`.trim();
        break;
      default:
        content = "[Tipo de mensagem não suportado pelo CRM]";
    }

    return {
      channelIdentifier: (payload.phoneNumberId as string | undefined) ?? null,
      fromPhone: withBrazilNinthDigit(stripBrazilCountryCode(String(message.from ?? ""))),
      fromName: (payload.contactName as string | undefined) ?? null,
      content,
      type,
      mediaUrl,
      providerMessageId: (message.id as string | undefined) ?? null,
    };
  },
};

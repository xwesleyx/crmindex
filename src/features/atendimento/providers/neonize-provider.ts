import { stripBrazilCountryCode, withBrazilCountryCode } from "@/lib/validators";
import type {
  InboundMessagePayload,
  MarkAsReadInput,
  MessageProvider,
  NormalizedInboundMessage,
  SendMessageInput,
  SendMessageResult,
} from "@/features/atendimento/providers/types";

// Provider real (seção 20/24 do adendo de Atendimento) — fala com o
// whatsapp-service/ (Python + Neonize) por HTTP, nunca direto com o
// WhatsApp. O segredo nunca é exposto ao browser — isso aqui só roda em
// código de servidor (actions.ts, a rota de webhook).
function serviceUrl(path: string): string {
  const base = process.env.WHATSAPP_SERVICE_URL;
  if (!base) throw new Error("WHATSAPP_SERVICE_URL não configurado.");
  return `${base.replace(/\/$/, "")}${path}`;
}

function secret(): string {
  const value = process.env.WHATSAPP_SERVICE_SECRET;
  if (!value) throw new Error("WHATSAPP_SERVICE_SECRET não configurado.");
  return value;
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" };
}

type SendResponseBody = { status: string; providerMessageId?: string; mediaUrl?: string; error?: string };

// multipart/form-data — sem Content-Type manual, o fetch calcula o boundary
// sozinho a partir do FormData (authHeaders() força application/json, então
// não dá pra reaproveitar aqui).
async function sendMedia(input: SendMessageInput): Promise<Response> {
  const mediaFile = input.mediaFile!;
  const form = new FormData();
  form.append("to", withBrazilCountryCode(input.to));
  form.append("type", input.type);
  if (input.content) form.append("caption", input.content);
  form.append("filename", mediaFile.filename);
  if (input.quoted) {
    form.append("quotedProviderMessageId", input.quoted.providerMessageId);
    form.append("quotedParticipant", withBrazilCountryCode(input.quoted.participant));
    form.append("quotedText", input.quoted.content);
  }
  form.append("file", new Blob([new Uint8Array(mediaFile.buffer)], { type: mediaFile.mimetype }), mediaFile.filename);

  return fetch(serviceUrl("/send-media"), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret()}` },
    body: form,
  });
}

export const neonizeProvider: MessageProvider = {
  name: "neonize",

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    try {
      const response = input.mediaFile
        ? await sendMedia(input)
        : await fetch(serviceUrl("/send"), {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              to: withBrazilCountryCode(input.to),
              text: input.content,
              quotedProviderMessageId: input.quoted?.providerMessageId,
              quotedParticipant: input.quoted ? withBrazilCountryCode(input.quoted.participant) : undefined,
              quotedText: input.quoted?.content,
            }),
          });

      const body = (await response.json()) as SendResponseBody;

      if (!response.ok || body.status !== "SENT") {
        console.error("neonizeProvider.sendMessage falhou:", body.error ?? response.statusText);
        return { status: "FAILED", providerMessageId: null, mediaUrl: body.mediaUrl ?? null };
      }

      return { status: "SENT", providerMessageId: body.providerMessageId ?? null, mediaUrl: body.mediaUrl ?? null };
    } catch (error) {
      console.error("neonizeProvider.sendMessage: erro ao chamar o whatsapp-service", error);
      return { status: "FAILED", providerMessageId: null };
    }
  },

  async markAsRead(input: MarkAsReadInput): Promise<boolean> {
    try {
      const response = await fetch(serviceUrl("/mark-read"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ to: withBrazilCountryCode(input.to), messageIds: input.providerMessageIds }),
      });
      return response.ok;
    } catch (error) {
      console.error("neonizeProvider.markAsRead: erro ao chamar o whatsapp-service", error);
      return false;
    }
  },

  // Traduz o payload que o whatsapp-service (Python) manda pro webhook —
  // formato definido junto com whatsapp-service/main.py, não é a API crua
  // do WhatsApp.
  normalizeInbound(payload: InboundMessagePayload): NormalizedInboundMessage {
    const validTypes = ["TEXT", "IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER", "LOCATION", "SYSTEM"];
    const type = typeof payload.type === "string" && validTypes.includes(payload.type) ? payload.type : "TEXT";

    return {
      channelIdentifier: (payload.channelIdentifier as string | undefined) ?? null,
      // Chega do WhatsApp com o "55" na frente — normaliza pro mesmo formato
      // (DDD + número, sem código do país) que o resto do CRM usa, senão um
      // contato criado manualmente nunca bate com o mesmo número chegando de
      // verdade pelo WhatsApp (validators.ts tem o porquê completo).
      fromPhone: stripBrazilCountryCode(String(payload.fromPhone ?? "")),
      fromName: (payload.fromName as string | undefined) ?? null,
      content: String(payload.content ?? ""),
      type: type as NormalizedInboundMessage["type"],
      mediaUrl: (payload.mediaUrl as string | undefined) ?? null,
      providerMessageId: (payload.providerMessageId as string | undefined) ?? null,
    };
  },
};

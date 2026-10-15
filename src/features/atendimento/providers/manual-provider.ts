import type {
  InboundMessagePayload,
  MessageProvider,
  NormalizedInboundMessage,
  SendMessageInput,
  SendMessageResult,
} from "@/features/atendimento/providers/types";

// Único provider desta etapa (seção 2: "não integrar WhatsApp real ainda").
// "Enviar" aqui só marca a mensagem como SENT sem chamar nenhuma API externa
// — é o atendente digitando na Central, não o WhatsApp de verdade. Quando um
// provider real (ex: WhatsApp Cloud API) for conectado, ele implementa a
// mesma interface MessageProvider e entra no registry (registry.ts) sem
// alterar nenhuma action ou componente da Central.
export const manualProvider: MessageProvider = {
  name: "manual",

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    void input;
    return { status: "SENT", providerMessageId: null };
  },

  normalizeInbound(payload: InboundMessagePayload): NormalizedInboundMessage {
    return {
      channelIdentifier: (payload.channelIdentifier as string | undefined) ?? null,
      fromPhone: String(payload.fromPhone ?? ""),
      fromName: (payload.fromName as string | undefined) ?? null,
      content: String(payload.content ?? ""),
      type: "TEXT",
      mediaUrl: null,
      providerMessageId: (payload.providerMessageId as string | undefined) ?? null,
    };
  },
};

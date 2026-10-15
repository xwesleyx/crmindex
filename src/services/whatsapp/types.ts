// Contrato de integração com WhatsApp (Fase 7). Qualquer provedor (Cloud
// API oficial, Twilio, 360dialog, etc.) implementa esta interface — o resto
// do CRM depende apenas dela, nunca de um provedor específico.

export type WhatsAppMessageDirection = "INBOUND" | "OUTBOUND";

export type WhatsAppMessage = {
  id: string;
  conversationId: string;
  direction: WhatsAppMessageDirection;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video" | "document";
  sentAt: Date;
};

export type WhatsAppConversation = {
  id: string;
  contactPhone: string;
  messages: WhatsAppMessage[];
};

export interface WhatsAppProvider {
  sendMessage(params: { to: string; text: string }): Promise<WhatsAppMessage>;
  sendMedia(params: {
    to: string;
    mediaUrl: string;
    mediaType: WhatsAppMessage["mediaType"];
    caption?: string;
  }): Promise<WhatsAppMessage>;
  receiveMessage(rawWebhookPayload: unknown): Promise<WhatsAppMessage>;
  getConversation(contactPhone: string): Promise<WhatsAppConversation | null>;
}

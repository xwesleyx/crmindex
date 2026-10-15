import type { ConversationQueue, ConversationStatus, MessageStatus, MessageType } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  OPEN: "Em aberto",
  WAITING_CUSTOMER: "Aguardando cliente",
  WAITING_INTERNAL: "Aguardando atendimento",
  RESOLVED: "Resolvida",
  CLOSED: "Encerrada",
};

export const CONVERSATION_STATUS_TONE: Record<ConversationStatus, BadgeTone> = {
  OPEN: "info",
  WAITING_CUSTOMER: "warning",
  WAITING_INTERNAL: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

// Status "cru" (o valor salvo no banco) não é o que faz mais sentido mostrar
// pro atendente — uma conversa OPEN sem responsável e uma OPEN já assumida
// por alguém são situações bem diferentes na prática, mas têm o mesmo
// status. Esta função deriva o que aparece na lista/cabeçalho da conversa:
// Aguardando atendimento (sem responsável, ainda ativa) / Em atendimento
// (responsável definido, ativa) / Aguardando cliente / Encerrada — 4 cores
// bem distintas, sempre reaproveitando os tons semânticos já existentes.
export function getConversationDisplayStatus(conversation: {
  status: ConversationStatus;
  assigneeId: string | null;
}): { label: string; tone: BadgeTone } {
  if (conversation.status === "CLOSED" || conversation.status === "RESOLVED") {
    return { label: CONVERSATION_STATUS_LABELS[conversation.status], tone: "neutral" };
  }
  if (conversation.status === "WAITING_CUSTOMER") {
    return { label: "Aguardando cliente", tone: "success" };
  }
  if (!conversation.assigneeId) {
    return { label: "Aguardando atendimento", tone: "warning" };
  }
  return { label: "Em atendimento", tone: "info" };
}

// Indicador colorido na lista de conversas (bolinha da seção 8/9) — segue a
// mesma derivação acima, não o status cru.
export function getConversationStatusDot(conversation: {
  status: ConversationStatus;
  assigneeId: string | null;
}): string {
  const DOT_BY_TONE: Record<BadgeTone, string> = {
    neutral: "bg-muted-foreground",
    info: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };
  return DOT_BY_TONE[getConversationDisplayStatus(conversation).tone];
}

export const CONVERSATION_QUEUE_LABELS: Record<ConversationQueue, string> = {
  COMERCIAL: "Comercial",
  SUPORTE: "Suporte",
  FINANCEIRO: "Financeiro",
  IMPLANTACAO: "Implantação",
};

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  TEXT: "Texto",
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  AUDIO: "Áudio",
  DOCUMENT: "Documento",
  STICKER: "Figurinha",
  LOCATION: "Localização",
  SYSTEM: "Sistema",
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  PENDING: "Enviando...",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falhou",
};

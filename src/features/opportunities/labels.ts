import type { LossReason, OpportunityStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export { LEAD_ORIGIN_LABELS as ORIGIN_LABELS } from "@/features/leads/labels";
export { PRIORITY_LABELS } from "@/lib/priority";

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  OPEN: "Em aberto",
  WON: "Ganha",
  LOST: "Perdida",
};

export const OPPORTUNITY_STATUS_TONE: Record<OpportunityStatus, BadgeTone> = {
  OPEN: "neutral",
  WON: "success",
  LOST: "destructive",
};

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  PRECO: "Preço",
  CONCORRENTE: "Concorrente",
  SEM_INTERESSE: "Sem interesse",
  SEM_ORCAMENTO: "Sem orçamento",
  PRAZO: "Prazo",
  OUTRO: "Outro",
};

import { LeadOrigin, LeadStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: "Novo",
  CONTATO_REALIZADO: "Contato realizado",
  EM_ATENDIMENTO: "Em atendimento",
  QUALIFICADO: "Qualificado",
  NAO_QUALIFICADO: "Não qualificado",
  CONVERTIDO: "Convertido",
  PERDIDO: "Perdido",
};

export const LEAD_STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  NOVO: "neutral",
  CONTATO_REALIZADO: "neutral",
  EM_ATENDIMENTO: "info",
  QUALIFICADO: "success",
  NAO_QUALIFICADO: "neutral",
  CONVERTIDO: "success",
  PERDIDO: "destructive",
};

// Priority mudou pra lib/priority.ts — é um enum compartilhado por
// Lead/Opportunity/Task/Installation, não algo exclusivo de Lead.
export { PRIORITY_LABELS } from "@/lib/priority";

export const LEAD_FIELD_LABELS: Record<string, string> = {
  name: "nome",
  phone: "telefone",
  whatsapp: "WhatsApp",
  email: "e-mail",
  companyName: "empresa",
  companyCnpj: "CNPJ",
  notes: "observações",
  nextActionAt: "próxima ação (data)",
  nextActionNote: "próxima ação (nota)",
  lastInteractionAt: "última interação",
};

export const LEAD_ORIGIN_LABELS: Record<LeadOrigin, string> = {
  WHATSAPP: "WhatsApp",
  INDICACAO: "Indicação",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  SITE: "Site",
  GOOGLE: "Google",
  TELEFONE: "Telefone",
  EVENTO: "Evento",
  PROSPECCAO: "Prospecção",
  OUTRO: "Outro",
};

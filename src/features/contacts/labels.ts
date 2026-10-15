import type { ContactLinkType } from "@prisma/client";

export { LEAD_ORIGIN_LABELS as ORIGIN_LABELS } from "@/features/leads/labels";
export { ACTIVE_STATUS_TONE, ACTIVE_STATUS_LABEL } from "@/features/companies/labels";

export const CONTACT_LINK_TYPE_LABELS: Record<ContactLinkType, string> = {
  FUNCIONARIO: "Funcionário",
  GERENTE: "Gerente",
  DIRETOR: "Diretor",
  SOCIO: "Sócio",
  RESPONSAVEL: "Responsável",
  FINANCEIRO: "Financeiro",
  TECNICO: "Técnico",
  OUTRO: "Outro",
};

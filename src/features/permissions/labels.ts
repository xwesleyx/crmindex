import type { CapabilityKey } from "@/lib/permissions";

export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  "kanban.edit": "Editar etapas do Kanban",
  "leads.delete": "Arquivar Leads",
  "opportunities.delete": "Arquivar Oportunidades",
  "relatorios.export": "Exportar PDF dos Relatórios",
  "financeiro.view_values": "Ver valores no Financeiro",
  "atendimento.view_all": "Ver atendimento de todos",
  "atendimento.create_opportunity": "Criar oportunidade pelo Atendimento",
};


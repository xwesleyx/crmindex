// Colunas iniciais do Kanban comercial (seção 15/16 do escopo da Fase 2).
// Vêm do banco (KanbanStage), não de um enum — isto aqui é só a seed inicial,
// as colunas (nome/cor/ordem, + criar/excluir) são editáveis via
// Configurações > Kanbans (features/kanban-stages/).
export const COMMERCIAL_STAGES = [
  { key: "NOVO_LEAD", name: "Novo Lead", order: 1, color: "#64748b" },
  { key: "PRIMEIRO_CONTATO", name: "Primeiro Contato", order: 2, color: "#2e8fe6" },
  { key: "EM_ATENDIMENTO", name: "Em Atendimento", order: 3, color: "#f2b134" },
  { key: "QUALIFICADO", name: "Qualificado", order: 4, color: "#8b5cf6" },
  { key: "OPORTUNIDADE", name: "Oportunidade", order: 5, color: "#f0713a" },
  { key: "PROPOSTA", name: "Proposta", order: 6, color: "#2e8fe6" },
  { key: "NEGOCIACAO", name: "Negociação", order: 7, color: "#f2b134" },
  { key: "FECHAMENTO", name: "Fechamento", order: 8, color: "#8b5cf6" },
  { key: "VENDA_GANHA", name: "Venda Ganha", order: 9, color: "#16a34a" },
  { key: "VENDA_PERDIDA", name: "Venda Perdida", order: 10, color: "#e23b49" },
] as const;

export type CommercialStageKey = (typeof COMMERCIAL_STAGES)[number]["key"];

export const WON_STAGE_KEY: CommercialStageKey = "VENDA_GANHA";
export const LOST_STAGE_KEY: CommercialStageKey = "VENDA_PERDIDA";

// Colunas iniciais do Kanban de instalação (seção 17 da Etapa 5) — mesmo
// princípio: vêm do banco, isto é só a seed inicial.
export const INSTALLATION_STAGES = [
  { key: "AGUARDANDO_INSTALACAO", name: "Aguardando Instalação", order: 1, color: "#64748b" },
  { key: "EM_PREPARACAO", name: "Em Preparação", order: 2, color: "#2e8fe6" },
  { key: "AGENDADA", name: "Agendada", order: 3, color: "#f2b134" },
  { key: "EM_INSTALACAO", name: "Em Instalação", order: 4, color: "#8b5cf6" },
  { key: "AGUARDANDO_CLIENTE", name: "Aguardando Cliente", order: 5, color: "#f0713a" },
  { key: "EM_VALIDACAO", name: "Em Validação", order: 6, color: "#22a55e" },
  { key: "CONCLUIDA", name: "Concluída", order: 7, color: "#16a34a" },
  { key: "CANCELADA", name: "Cancelada", order: 8, color: "#e23b49" },
] as const;

export type InstallationStageKey = (typeof INSTALLATION_STAGES)[number]["key"];

export const INSTALLATION_COMPLETED_STAGE_KEY: InstallationStageKey = "CONCLUIDA";
export const INSTALLATION_CANCELED_STAGE_KEY: InstallationStageKey = "CANCELADA";

// As 4 etapas "especiais" acima têm chave lida por automações de negócio
// (win-automation.ts, opportunities/actions.ts, installations/actions.ts) —
// não podem ser arquivadas/excluídas pela tela de Configurações (ver
// features/kanban-stages/actions.ts), só renomeadas/recoloridas.
export const PROTECTED_STAGE_KEYS: readonly string[] = [
  WON_STAGE_KEY,
  LOST_STAGE_KEY,
  INSTALLATION_COMPLETED_STAGE_KEY,
  INSTALLATION_CANCELED_STAGE_KEY,
];

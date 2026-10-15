import type { UserRole } from "@prisma/client";

export const MODULES = {
  dashboard: "dashboard",
  crm: "crm",
  atendimento: "atendimento",
  clientes: "clientes",
  instalacoes: "instalacoes",
  financeiro: "financeiro",
  catalogo: "catalogo",
  // Antes um único "relatorios" — agora granular por tipo (seção "abrir por
  // relevância": Vendedor só Comercial, Instalador só Instalações, etc.).
  relatorios_atendimento: "relatorios_atendimento",
  relatorios_comercial: "relatorios_comercial",
  relatorios_instalacoes: "relatorios_instalacoes",
  agenda: "agenda",
  configuracoes: "configuracoes",
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

const ALL_MODULES: ModuleKey[] = Object.values(MODULES);

// Seção 18 do escopo: perfis e módulos permitidos. Autorização real (não é
// só esconder botão) — sempre validar no servidor via `canAccessModule`.
const ROLE_MODULES: Record<UserRole, ModuleKey[]> = {
  ADMIN: ALL_MODULES,
  GERENTE: [
    "dashboard",
    "crm",
    "atendimento",
    "clientes",
    "instalacoes",
    "financeiro",
    "catalogo",
    "relatorios_atendimento",
    "relatorios_comercial",
    "relatorios_instalacoes",
    "agenda",
  ],
  VENDEDOR: ["dashboard", "crm", "atendimento", "clientes", "catalogo", "relatorios_comercial", "agenda"],
  ATENDIMENTO: ["dashboard", "atendimento", "clientes", "relatorios_atendimento", "agenda"],
  INSTALADOR: ["dashboard", "instalacoes", "clientes", "relatorios_instalacoes", "agenda"],
  FINANCEIRO: ["dashboard", "financeiro", "relatorios_comercial", "clientes", "agenda"],
};

// Somente ADMIN acessa Configurações (usuários, permissões, kanbans, integrações).
export function canAccessModule(role: UserRole, moduleKey: ModuleKey): boolean {
  if (moduleKey === "configuracoes") return role === "ADMIN";
  return ROLE_MODULES[role]?.includes(moduleKey) ?? false;
}

export function getAccessibleModules(role: UserRole): ModuleKey[] {
  return ALL_MODULES.filter((moduleKey) => canAccessModule(role, moduleKey));
}

// Telas que dá pra ligar/desligar por usuário em Configurações > Permissões.
// "configuracoes" fica de fora: é exclusiva de Administrador (as páginas
// checam role === "ADMIN" direto), então liberar pra outro perfil só
// mostraria um menu que não abre.
export const EDITABLE_MODULES: ModuleKey[] = ALL_MODULES.filter((moduleKey) => moduleKey !== "configuracoes");

// Permissões de ação (aditivas, por usuário) — não confundir com ModuleKey
// (tela/menu). Conjunto curado e extensível: adicionar uma nova capacidade
// aqui não exige migração, só um novo check no ponto de uso.
export const CAPABILITIES = {
  kanbanEdit: "kanban.edit",
  leadsDelete: "leads.delete",
  opportunitiesDelete: "opportunities.delete",
  relatoriosExport: "relatorios.export",
  financeiroViewValues: "financeiro.view_values",
  // Ver (e agir em) todos os atendimentos, de todo mundo — Central e Quadro.
  atendimentoViewAll: "atendimento.view_all",
  // Botão "Criar oportunidade" no painel da conversa (só aparece quando a
  // empresa do contato ainda não é cliente).
  atendimentoCreateOpportunity: "atendimento.create_opportunity",
} as const;

export type CapabilityKey = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

// Por padrão nenhum perfil tem capacidades extras além do que o módulo já
// libera — hoje só ADMIN/GERENTE fazem essas ações via canEditX de cada
// entidade. Overrides por usuário podem conceder pra outros perfis, ou
// revogar até de ADMIN/GERENTE.
const ROLE_CAPABILITIES: Record<UserRole, CapabilityKey[]> = {
  ADMIN: Object.values(CAPABILITIES),
  // Criar oportunidade pelo Atendimento: por padrão só Vendedor e
  // Administrador (pedido do usuário) — Gerente pode ganhar por usuário.
  GERENTE: Object.values(CAPABILITIES).filter((c) => c !== CAPABILITIES.atendimentoCreateOpportunity),
  VENDEDOR: [CAPABILITIES.atendimentoCreateOpportunity],
  ATENDIMENTO: [],
  INSTALADOR: [],
  FINANCEIRO: [],
};

// Overrides já resolvidos (JSON parseado) — ver src/lib/permission-overrides.ts
// pra quem lê/grava a linha do banco. Mantido aqui como tipo puro pra não
// criar dependência circular entre os dois arquivos.
export type ResolvedPermissionOverrides = {
  modulesGranted: ModuleKey[];
  modulesRevoked: ModuleKey[];
  capabilities: Partial<Record<CapabilityKey, boolean>>;
};

// overrides é opcional de propósito: todo call site existente (~58 no
// projeto) continua funcionando sem passar nada — só quem precisa honrar
// overrides (sidebar, guards de página, uma ação pontual) passa o argumento
// novo. Revogado vence concedido vence o padrão do perfil.
export function isModuleVisible(
  role: UserRole,
  moduleKey: ModuleKey,
  overrides?: ResolvedPermissionOverrides | null
): boolean {
  // Administrador também pode ter telas ajustadas (pedido do usuário).
  // Configurações não entra nos ajustes (EDITABLE_MODULES) e as telas dela
  // checam role === "ADMIN" direto — então nenhum ajuste tranca um admin
  // fora de Permissões.
  if (overrides?.modulesRevoked.includes(moduleKey)) return false;
  if (overrides?.modulesGranted.includes(moduleKey)) return true;
  return canAccessModule(role, moduleKey);
}

// Padrão do perfil, sem override — a tela de Permissões compara o que foi
// marcado com isso pra gravar só o que diverge.
export function roleHasCapability(role: UserRole, capability: CapabilityKey): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function hasCapability(
  role: UserRole,
  capability: CapabilityKey,
  overrides?: ResolvedPermissionOverrides | null
): boolean {
  // Administrador começa com tudo (ROLE_CAPABILITIES), mas os ajustes por
  // usuário valem pra ele também.
  const override = overrides?.capabilities[capability];
  if (override !== undefined) return override;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

// Cuids (ex: "cmtvxr3s7000xmk5wvk5iwb9v") não devem aparecer crus pro usuário
// (breadcrumb, títulos de fallback etc.) — vira um código curto e estável
// derivado do próprio id, sem precisar de contador/migração no banco.
export function formatEntityCode(id: string, prefix?: string): string {
  const short = id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return prefix ? `${prefix}-${short}` : `#${short}`;
}

// Prefixo pelo segmento de rota imediatamente anterior ao id — cobre todos
// os módulos com detail page (/leads/[id], /clientes/empresas/[id] etc.).
const PREFIX_BY_PARENT_SEGMENT: Record<string, string> = {
  leads: "LD",
  oportunidades: "OP",
  vendas: "VD",
  instalacoes: "IN",
  atendimento: "AT",
  contatos: "CT",
  empresas: "EMP",
  clientes: "CL",
  usuarios: "USR",
};

export function formatEntityCodeForRoute(parentSegment: string, id: string): string {
  return formatEntityCode(id, PREFIX_BY_PARENT_SEGMENT[parentSegment]);
}

// cuid v1/v2 sempre tem 20+ caracteres alfanuméricos, sem espaço/traço — um
// segmento de rota "normal" (slug de nav) é bem mais curto que isso.
export function looksLikeEntityId(segment: string): boolean {
  return /^[a-z0-9]{20,}$/i.test(segment);
}

import type { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// Granularidade específica do módulo (seção 20 do escopo): Admin/Gerente
// veem tudo; Vendedor só enxerga o que é seu ou ainda não foi assumido.
// Atendimento/Instalador/Financeiro nem chegam aqui — o módulo "crm" já é
// bloqueado a nível de rota em src/lib/permissions.ts.
export function canViewAllLeads(role: UserRole): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

export function leadWhereForRole(
  role: UserRole,
  userId: string
): Prisma.LeadWhereInput {
  if (canViewAllLeads(role)) return {};
  return { OR: [{ responsibleId: userId }, { responsibleId: null }] };
}

export function canEditLead(
  role: UserRole,
  userId: string,
  lead: { responsibleId: string | null }
): boolean {
  if (canViewAllLeads(role)) return true;
  return lead.responsibleId === null || lead.responsibleId === userId;
}

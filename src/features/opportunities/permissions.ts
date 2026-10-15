import type { Prisma, UserRole } from "@prisma/client";

// Mesma regra de Lead (não a de Contact/Company): Opportunity vive no
// módulo "crm", que só ADMIN/GERENTE/VENDEDOR acessam — não há
// Atendimento/Instalador/Financeiro aqui para justificar a visão ampla
// usada em Contatos/Empresas (seção 21 do escopo: reaproveitar a lógica
// já estabelecida, que para o "crm" é a de Leads).
export function canViewAllOpportunities(role: UserRole): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

export function opportunityWhereForRole(
  role: UserRole,
  userId: string
): Prisma.OpportunityWhereInput {
  if (canViewAllOpportunities(role)) return {};
  return { OR: [{ ownerId: userId }, { ownerId: null }] };
}

export function canEditOpportunity(
  role: UserRole,
  userId: string,
  opportunity: { ownerId: string | null }
): boolean {
  if (canViewAllOpportunities(role)) return true;
  return opportunity.ownerId === null || opportunity.ownerId === userId;
}

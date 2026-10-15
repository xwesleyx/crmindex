import type { Prisma, UserRole } from "@prisma/client";

// Mesmo padrão de Leads (src/features/leads/permissions.ts), mas com uma
// diferença deliberada: o módulo "clientes" é acessível por 5 perfis (não só
// ADMIN/GERENTE/VENDEDOR como o "crm" dos Leads — ver src/lib/permissions.ts).
// Atendimento/Instalador/Financeiro precisam ver todas as empresas para o
// trabalho operacional deles e nunca têm responsibleId preenchido, então a
// visão restrita a "meus registros" só faz sentido para o Vendedor.
export function canViewAllCompanies(role: UserRole): boolean {
  return role !== "VENDEDOR";
}

export function companyWhereForRole(
  role: UserRole,
  userId: string
): Prisma.CompanyWhereInput {
  if (canViewAllCompanies(role)) return {};
  return { OR: [{ responsibleId: userId }, { responsibleId: null }] };
}

export function canEditCompany(
  role: UserRole,
  userId: string,
  company: { responsibleId: string | null }
): boolean {
  if (canViewAllCompanies(role)) return true;
  return company.responsibleId === null || company.responsibleId === userId;
}

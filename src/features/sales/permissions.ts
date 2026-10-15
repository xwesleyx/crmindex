import type { Prisma, UserRole } from "@prisma/client";

// Vendas vivem no menu CRM (nav-config.ts) — mesma regra de acesso de
// Leads/Oportunidades: só ADMIN/GERENTE/VENDEDOR chegam aqui.
export function canViewAllSales(role: UserRole): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

export function saleWhereForRole(role: UserRole, userId: string): Prisma.SaleWhereInput {
  if (canViewAllSales(role)) return {};
  return { OR: [{ ownerId: userId }, { ownerId: null }] };
}

export function canEditSale(
  role: UserRole,
  userId: string,
  sale: { ownerId: string | null }
): boolean {
  if (canViewAllSales(role)) return true;
  return sale.ownerId === null || sale.ownerId === userId;
}

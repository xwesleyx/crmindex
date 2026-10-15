import type { Prisma, UserRole } from "@prisma/client";

// Mesmo padrão de Companies/Contacts (módulo "clientes", 5 perfis) — só o
// Vendedor tem visão restrita.
export function canViewAllCustomers(role: UserRole): boolean {
  return role !== "VENDEDOR";
}

export function customerWhereForRole(
  role: UserRole,
  userId: string
): Prisma.CustomerWhereInput {
  if (canViewAllCustomers(role)) return {};
  return { OR: [{ responsibleId: userId }, { responsibleId: null }] };
}

export function canEditCustomer(
  role: UserRole,
  userId: string,
  customer: { responsibleId: string | null }
): boolean {
  if (canViewAllCustomers(role)) return true;
  return customer.responsibleId === null || customer.responsibleId === userId;
}

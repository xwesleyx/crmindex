import type { Prisma, UserRole } from "@prisma/client";

// Mesmo padrão de Companies/Leads (seção 12 da Etapa 3) — só o Vendedor tem
// visão restrita a "meus registros"; os demais perfis que acessam "clientes"
// (Atendimento/Instalador/Financeiro) precisam ver tudo para o trabalho
// operacional deles.
export function canViewAllContacts(role: UserRole): boolean {
  return role !== "VENDEDOR";
}

export function contactWhereForRole(
  role: UserRole,
  userId: string
): Prisma.ContactWhereInput {
  if (canViewAllContacts(role)) return {};
  return { OR: [{ responsibleId: userId }, { responsibleId: null }] };
}

export function canEditContact(
  role: UserRole,
  userId: string,
  contact: { responsibleId: string | null }
): boolean {
  if (canViewAllContacts(role)) return true;
  return contact.responsibleId === null || contact.responsibleId === userId;
}

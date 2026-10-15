import type { Prisma, UserRole } from "@prisma/client";

// Módulo "instalacoes" (src/lib/permissions.ts) é acessível por
// ADMIN/GERENTE/INSTALADOR. Só o Instalador tem visão restrita ao que é
// dele — mesmo princípio do Vendedor em Leads/Oportunidades (seção 26).
export function canViewAllInstallations(role: UserRole): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

export function installationWhereForRole(
  role: UserRole,
  userId: string
): Prisma.InstallationWhereInput {
  if (canViewAllInstallations(role)) return {};
  return { OR: [{ responsibleId: userId }, { responsibleId: null }] };
}

export function canEditInstallation(
  role: UserRole,
  userId: string,
  installation: { responsibleId: string | null }
): boolean {
  if (canViewAllInstallations(role)) return true;
  return installation.responsibleId === null || installation.responsibleId === userId;
}

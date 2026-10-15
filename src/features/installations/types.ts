import type { Prisma } from "@prisma/client";

// Região da instalação é sempre resolvida pelo Cliente dela (Customer é a
// única entidade com relação direta a Region aqui) — nunca um campo próprio
// (ver src/features/regions/query-helpers.ts, installationRegionWhere):
// region do próprio Customer, senão da Empresa/Contato vinculado a ele.
const INSTALLATION_INCLUDE = {
  customer: {
    select: {
      id: true,
      region: { select: { id: true, name: true, color: true } },
      company: {
        select: { id: true, legalName: true, tradeName: true, region: { select: { id: true, name: true, color: true } } },
      },
      contact: {
        select: {
          id: true,
          name: true,
          company: { select: { id: true, region: { select: { id: true, name: true, color: true } } } },
        },
      },
    },
  },
  company: { select: { id: true, legalName: true, tradeName: true } },
  contact: { select: { id: true, name: true } },
  sale: {
    select: {
      id: true,
      amountCents: true,
      recurringAmountCents: true,
      discountCents: true,
      paymentMethod: true,
      owner: { select: { id: true, name: true } },
    },
  },
  responsible: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, key: true, order: true } },
  checklistItems: { select: { id: true, completed: true, required: true } },
} as const;

export type InstallationListItem = Prisma.InstallationGetPayload<{
  include: typeof INSTALLATION_INCLUDE;
}>;

export type InstallationDetail = Prisma.InstallationGetPayload<{
  include: typeof INSTALLATION_INCLUDE & {
    opportunity: { select: { id: true; title: true } };
    checklistItems: { orderBy: { order: "asc" }; include: { completedBy: { select: { id: true; name: true } } } };
  };
}>;

export { INSTALLATION_INCLUDE };

export function checklistProgress(items: { completed: boolean }[]) {
  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

// Atrasada = prazo vencido e ainda em andamento — concluída/cancelada nunca
// conta como atraso, mesmo que o prazo já tenha passado (seção 6/12).
export function isInstallationOverdue(installation: {
  dueAt: Date | string | null;
  status: string;
}): boolean {
  if (!installation.dueAt || installation.status !== "EM_ANDAMENTO") return false;
  return new Date(installation.dueAt).getTime() < Date.now();
}

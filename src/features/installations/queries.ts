import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sortByPriorityThen } from "@/lib/priority";
import { installationWhereForRole } from "@/features/installations/permissions";
import { INSTALLATION_INCLUDE } from "@/features/installations/types";
import type { InstallationFilters } from "@/features/installations/schema";
import { installationRegionWhere } from "@/features/regions/query-helpers";

export const INSTALLATIONS_PAGE_SIZE = 20;

function baseWhere(
  filters: InstallationFilters,
  currentUser: { id: string; role: UserRole }
): Prisma.InstallationWhereInput {
  return {
    AND: [
      installationWhereForRole(currentUser.role, currentUser.id),
      filters.responsibleId ? { responsibleId: filters.responsibleId } : {},
      filters.priority ? { priority: filters.priority } : {},
      filters.status ? { status: filters.status } : {},
      filters.dateFrom ? { createdAt: { gte: filters.dateFrom } } : {},
      filters.dateTo ? { createdAt: { lte: filters.dateTo } } : {},
      filters.q
        ? {
            OR: [
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              { contact: { name: { contains: filters.q } } },
            ],
          }
        : {},
    ],
  };
}

export async function listInstallations(
  filters: InstallationFilters,
  currentUser: { id: string; role: UserRole }
) {
  const where: Prisma.InstallationWhereInput = {
    AND: [baseWhere(filters, currentUser), filters.stageId ? { stageId: filters.stageId } : {}],
  };

  const [items, total] = await Promise.all([
    prisma.installation.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * INSTALLATIONS_PAGE_SIZE,
      take: INSTALLATIONS_PAGE_SIZE,
      include: INSTALLATION_INCLUDE,
    }),
    prisma.installation.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: INSTALLATIONS_PAGE_SIZE };
}

export async function getInstallation(id: string) {
  return prisma.installation.findUnique({
    where: { id },
    include: {
      ...INSTALLATION_INCLUDE,
      opportunity: { select: { id: true, title: true } },
      checklistItems: {
        orderBy: { order: "asc" },
        include: { completedBy: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function getInstallationStages() {
  return prisma.kanbanStage.findMany({
    where: { board: "INSTALLATION", active: true, deletedAt: null },
    orderBy: { order: "asc" },
  });
}

// Board inteiro em 2 queries — mesmo princípio do Kanban comercial (seção 36
// da Etapa 5: evitar N+1, buscar em lote).
export async function getInstallationKanbanData(
  filters: InstallationFilters,
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const [stages, installations] = await Promise.all([
    getInstallationStages(),
    prisma.installation.findMany({
      where: { AND: [baseWhere(filters, currentUser), installationRegionWhere(regionIds)] },
      include: INSTALLATION_INCLUDE,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // kanbanOrder é o desempate principal (posição escolhida à mão no
  // drag-and-drop); updatedAt continua como reforço pra linhas empatadas em
  // 0 (default de quem nunca foi arrastada manualmente) não ficarem em
  // ordem arbitrária.
  const sortedInstallations = sortByPriorityThen(
    installations,
    (a, b) => a.kanbanOrder - b.kanbanOrder || b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const byStage = new Map<string, typeof installations>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const installation of sortedInstallations) {
    byStage.get(installation.stageId)?.push(installation);
  }

  const columns = stages.map((stage) => {
    const stageInstallations = byStage.get(stage.id) ?? [];
    return {
      stage,
      installations: stageInstallations,
      count: stageInstallations.length,
    };
  });

  return { columns };
}

// Responsável de instalação é um técnico, não um vendedor — lista separada
// da de Leads/Oportunidades (que é ADMIN/GERENTE/VENDEDOR).
export async function listInstallationAssignableUsers() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "GERENTE", "INSTALADOR"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getInstallationActivities(installationId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Installation", entityId: installationId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

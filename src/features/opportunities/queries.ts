import type { KanbanBoard, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sortByPriorityThen } from "@/lib/priority";
import { onlyDigits } from "@/lib/validators";
import { opportunityWhereForRole } from "@/features/opportunities/permissions";
import type { KanbanFilters, OpportunityFilters } from "@/features/opportunities/schema";
import { OPPORTUNITY_INCLUDE, type NextTaskByEntity } from "@/features/opportunities/types";
import { opportunityRegionWhere } from "@/features/regions/query-helpers";

export const OPPORTUNITIES_PAGE_SIZE = 20;

function baseWhere(
  filters: OpportunityFilters | KanbanFilters,
  currentUser: { id: string; role: UserRole }
): Prisma.OpportunityWhereInput {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";

  return {
    AND: [
      opportunityWhereForRole(currentUser.role, currentUser.id),
      { deletedAt: null },
      filters.ownerId ? { ownerId: filters.ownerId } : {},
      filters.priority ? { priority: filters.priority } : {},
      filters.origin ? { origin: filters.origin } : {},
      filters.status ? { status: filters.status } : {},
      filters.minValueCents !== undefined
        ? { estimatedValueCents: { gte: filters.minValueCents } }
        : {},
      filters.maxValueCents !== undefined
        ? { estimatedValueCents: { lte: filters.maxValueCents } }
        : {},
      filters.dateFrom ? { createdAt: { gte: filters.dateFrom } } : {},
      filters.dateTo ? { createdAt: { lte: filters.dateTo } } : {},
      filters.q
        ? {
            OR: [
              { title: { contains: filters.q } },
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              { contact: { name: { contains: filters.q } } },
              ...(qDigits.length >= 3
                ? [
                    { contact: { phone: { contains: qDigits } } },
                    { contact: { whatsapp: { contains: qDigits } } },
                  ]
                : []),
            ],
          }
        : {},
    ],
  };
}

export async function listOpportunities(
  filters: OpportunityFilters,
  currentUser: { id: string; role: UserRole }
) {
  const where: Prisma.OpportunityWhereInput = {
    AND: [baseWhere(filters, currentUser), filters.stageId ? { stageId: filters.stageId } : {}],
  };

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * OPPORTUNITIES_PAGE_SIZE,
      take: OPPORTUNITIES_PAGE_SIZE,
      include: OPPORTUNITY_INCLUDE,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: OPPORTUNITIES_PAGE_SIZE };
}

export async function getOpportunity(id: string) {
  return prisma.opportunity.findUnique({
    where: { id },
    include: { ...OPPORTUNITY_INCLUDE, sourceLead: { select: { id: true, name: true } } },
  });
}

export async function getKanbanStages(board: KanbanBoard = "COMMERCIAL") {
  return prisma.kanbanStage.findMany({
    where: { board, active: true, deletedAt: null },
    orderBy: { order: "asc" },
  });
}

// Board inteiro em 2 queries (oportunidades + tarefas em lote) — nunca uma
// query por card (seção 24).
export async function getKanbanData(
  filters: KanbanFilters,
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const [stages, opportunities] = await Promise.all([
    getKanbanStages("COMMERCIAL"),
    prisma.opportunity.findMany({
      where: { AND: [baseWhere(filters, currentUser), opportunityRegionWhere(regionIds)] },
      include: OPPORTUNITY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const nextTaskByOpportunity = await getNextTasksFor(opportunities.map((o) => o.id));

  // Urgente/alta aparecem primeiro dentro de cada coluna — SQLite não tem
  // enum nativo pra isso virar ORDER BY, então ordena em memória (o board
  // inteiro já vem numa única query, isso é só um sort sobre o resultado).
  // kanbanOrder é o desempate principal (posição escolhida à mão no
  // drag-and-drop); updatedAt continua como reforço pra linhas empatadas em
  // 0 (default de quem nunca foi arrastada manualmente) não ficarem em
  // ordem arbitrária.
  const sortedOpportunities = sortByPriorityThen(
    opportunities,
    (a, b) => a.kanbanOrder - b.kanbanOrder || b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const byStage = new Map<string, typeof opportunities>();
  for (const stage of stages) byStage.set(stage.id, []);
  for (const opp of sortedOpportunities) {
    byStage.get(opp.stageId)?.push(opp);
  }

  const columns = stages.map((stage) => {
    const stageOpportunities = byStage.get(stage.id) ?? [];
    return {
      stage,
      opportunities: stageOpportunities,
      count: stageOpportunities.length,
      totalCents: stageOpportunities.reduce((sum, o) => sum + o.estimatedValueCents, 0),
    };
  });

  return { columns, nextTaskByOpportunity };
}

export async function getNextTasksFor(opportunityIds: string[]): Promise<NextTaskByEntity> {
  if (opportunityIds.length === 0) return {};

  const tasks = await prisma.task.findMany({
    where: {
      entityType: "Opportunity",
      entityId: { in: opportunityIds },
      status: { not: "CONCLUIDA" },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, dueAt: true, entityId: true },
  });

  const result: NextTaskByEntity = {};
  for (const task of tasks) {
    if (!result[task.entityId]) {
      result[task.entityId] = { id: task.id, title: task.title, dueAt: task.dueAt };
    }
  }
  return result;
}

export async function getOpportunityActivities(opportunityId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Opportunity", entityId: opportunityId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

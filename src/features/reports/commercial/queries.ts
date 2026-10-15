import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { OPPORTUNITY_INCLUDE } from "@/features/opportunities/types";
import { opportunityRegionWhere } from "@/features/regions/query-helpers";
import type { CommercialReportFilters } from "@/features/reports/commercial/schema";

const PAGE_SIZE = 20;

// Visão de relatório, não a de edição/Kanban (opportunities/permissions.ts
// — essa é só pro módulo "crm" e não contempla Financeiro, que agora também
// acessa este relatório). Vendedor só vê o que é dele; os demais papéis com
// acesso ao relatório (ADMIN/GERENTE/FINANCEIRO) veem tudo.
function commercialReportWhereForRole(role: UserRole, userId: string): Prisma.OpportunityWhereInput {
  if (role === "VENDEDOR") return { OR: [{ ownerId: userId }, { ownerId: null }] };
  return {};
}

export async function listOpportunitiesForReport(
  filters: CommercialReportFilters,
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";
  const page = filters.page ?? 1;

  const where: Prisma.OpportunityWhereInput = {
    AND: [
      commercialReportWhereForRole(currentUser.role, currentUser.id),
      { deletedAt: null },
      opportunityRegionWhere(regionIds),
      filters.responsibleId ? { ownerId: filters.responsibleId } : {},
      filters.contactId ? { contactId: filters.contactId } : {},
      filters.companyId ? { companyId: filters.companyId } : {},
      filters.status !== "all" ? { status: filters.status } : {},
      filters.origin ? { origin: filters.origin } : {},
      filters.dateFrom ? { createdAt: { gte: new Date(filters.dateFrom) } } : {},
      filters.dateTo ? { createdAt: { lte: new Date(`${filters.dateTo}T23:59:59.999`) } } : {},
      filters.q
        ? {
            OR: [
              { title: { contains: filters.q } },
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              { contact: { name: { contains: filters.q } } },
              ...(qDigits.length >= 3
                ? [{ contact: { phone: { contains: qDigits } } }, { contact: { whatsapp: { contains: qDigits } } }]
                : []),
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: OPPORTUNITY_INCLUDE,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return { items, total, page, pageSize: PAGE_SIZE };
}

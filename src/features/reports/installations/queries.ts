import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { installationWhereForRole } from "@/features/installations/permissions";
import { INSTALLATION_INCLUDE } from "@/features/installations/types";
import { installationRegionWhere } from "@/features/regions/query-helpers";
import type { InstallationsReportFilters } from "@/features/reports/installations/schema";

const PAGE_SIZE = 20;

export async function listInstallationsForReport(
  filters: InstallationsReportFilters,
  currentUser: { id: string; role: UserRole },
  regionIds: string[] | null = null
) {
  const page = filters.page ?? 1;

  const where: Prisma.InstallationWhereInput = {
    AND: [
      installationWhereForRole(currentUser.role, currentUser.id),
      installationRegionWhere(regionIds),
      filters.responsibleId ? { responsibleId: filters.responsibleId } : {},
      filters.contactId
        ? { OR: [{ contactId: filters.contactId }, { customer: { contactId: filters.contactId } }] }
        : {},
      filters.companyId
        ? { OR: [{ companyId: filters.companyId }, { customer: { companyId: filters.companyId } }] }
        : {},
      filters.status !== "all" ? { status: filters.status } : {},
      filters.dateFrom ? { createdAt: { gte: new Date(filters.dateFrom) } } : {},
      filters.dateTo ? { createdAt: { lte: new Date(`${filters.dateTo}T23:59:59.999`) } } : {},
      filters.q
        ? {
            OR: [
              { customer: { contact: { name: { contains: filters.q } } } },
              { customer: { company: { legalName: { contains: filters.q } } } },
              { customer: { company: { tradeName: { contains: filters.q } } } },
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              { contact: { name: { contains: filters.q } } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.installation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: INSTALLATION_INCLUDE,
    }),
    prisma.installation.count({ where }),
  ]);

  return { items, total, page, pageSize: PAGE_SIZE };
}

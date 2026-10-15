import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { LeadFilters } from "@/features/leads/schema";
import { leadWhereForRole } from "@/features/leads/permissions";

export const LEADS_PAGE_SIZE = 20;

export async function listLeads(
  filters: LeadFilters,
  currentUser: { id: string; role: UserRole }
) {
  const where: Prisma.LeadWhereInput = {
    AND: [
      leadWhereForRole(currentUser.role, currentUser.id),
      filters.includeArchived ? {} : { deletedAt: null },
      filters.status ? { status: filters.status } : {},
      filters.priority ? { priority: filters.priority } : {},
      filters.origin ? { origin: filters.origin } : {},
      filters.responsibleId ? { responsibleId: filters.responsibleId } : {},
      filters.q
        ? {
            OR: [
              { name: { contains: filters.q } },
              { phone: { contains: filters.q } },
              { email: { contains: filters.q } },
              { companyName: { contains: filters.q } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * LEADS_PAGE_SIZE,
      take: LEADS_PAGE_SIZE,
      include: {
        responsible: { select: { id: true, name: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: LEADS_PAGE_SIZE };
}

export async function getLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      responsible: { select: { id: true, name: true, email: true } },
      opportunity: { select: { id: true, title: true } },
    },
  });
}

export async function listAssignableUsers() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "GERENTE", "VENDEDOR"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getLeadActivities(leadId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Lead", entityId: leadId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

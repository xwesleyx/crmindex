import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { saleWhereForRole } from "@/features/sales/permissions";
import { SALE_INCLUDE } from "@/features/sales/types";
import type { SaleFilters } from "@/features/sales/schema";

export const SALES_PAGE_SIZE = 20;

function baseWhere(
  filters: SaleFilters,
  currentUser: { id: string; role: UserRole }
): Prisma.SaleWhereInput {
  return {
    AND: [
      saleWhereForRole(currentUser.role, currentUser.id),
      filters.status ? { status: filters.status } : {},
      filters.ownerId ? { ownerId: filters.ownerId } : {},
      filters.minValueCents !== undefined ? { amountCents: { gte: filters.minValueCents } } : {},
      filters.maxValueCents !== undefined ? { amountCents: { lte: filters.maxValueCents } } : {},
      filters.dateFrom ? { soldAt: { gte: filters.dateFrom } } : {},
      filters.dateTo ? { soldAt: { lte: filters.dateTo } } : {},
      filters.q
        ? {
            OR: [
              { opportunity: { title: { contains: filters.q } } },
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              { contact: { name: { contains: filters.q } } },
            ],
          }
        : {},
    ],
  };
}

export async function listSales(filters: SaleFilters, currentUser: { id: string; role: UserRole }) {
  const where = baseWhere(filters, currentUser);

  const [items, total, aggregate] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * SALES_PAGE_SIZE,
      take: SALES_PAGE_SIZE,
      include: SALE_INCLUDE,
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where, _sum: { amountCents: true } }),
  ]);

  return {
    items,
    total,
    page: filters.page,
    pageSize: SALES_PAGE_SIZE,
    totalAmountCents: aggregate._sum.amountCents ?? 0,
  };
}

export async function getSale(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: { ...SALE_INCLUDE, installation: { include: { stage: true } } },
  });
}

export async function getSaleActivities(saleId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Sale", entityId: saleId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

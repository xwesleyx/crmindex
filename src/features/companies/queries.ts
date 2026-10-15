import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { companyWhereForRole } from "@/features/companies/permissions";
import type { CompanyFilters } from "@/features/companies/schema";

export const COMPANIES_PAGE_SIZE = 20;

export async function listCompanies(
  filters: CompanyFilters,
  currentUser: { id: string; role: UserRole }
) {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";

  const where: Prisma.CompanyWhereInput = {
    AND: [
      companyWhereForRole(currentUser.role, currentUser.id),
      filters.includeArchived ? {} : { deletedAt: null },
      filters.origin ? { origin: filters.origin } : {},
      filters.responsibleId ? { responsibleId: filters.responsibleId } : {},
      filters.q
        ? {
            OR: [
              { legalName: { contains: filters.q } },
              { tradeName: { contains: filters.q } },
              { email: { contains: filters.q } },
              ...(qDigits.length >= 3
                ? [{ cnpj: { contains: qDigits } }, { phone: { contains: qDigits } }]
                : []),
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * COMPANIES_PAGE_SIZE,
      take: COMPANIES_PAGE_SIZE,
      include: {
        responsible: { select: { id: true, name: true } },
        region: { select: { id: true, name: true, color: true } },
        customer: { select: { id: true, status: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: COMPANIES_PAGE_SIZE };
}

export async function getCompany(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      responsible: { select: { id: true, name: true, email: true } },
      region: { select: { id: true, name: true, color: true } },
      customer: { select: { id: true, status: true, becameCustomerAt: true } },
      contacts: { where: { deletedAt: null }, orderBy: { name: "asc" } },
    },
  });
}

export async function findCompanyByCnpj(cnpjDigits: string) {
  return prisma.company.findUnique({ where: { cnpj: cnpjDigits } });
}

export async function listCompanyOptions() {
  return prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, legalName: true, tradeName: true },
    orderBy: { legalName: "asc" },
  });
}

export async function getCompanyActivities(companyId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Company", entityId: companyId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { customerWhereForRole } from "@/features/customers/permissions";
import { CUSTOMER_DETAIL_INCLUDE, CUSTOMER_INCLUDE } from "@/features/customers/types";
import type { CustomerFilters } from "@/features/customers/schema";

export const CUSTOMERS_PAGE_SIZE = 20;

export async function listCustomers(
  filters: CustomerFilters,
  currentUser: { id: string; role: UserRole }
) {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";

  const where: Prisma.CustomerWhereInput = {
    AND: [
      customerWhereForRole(currentUser.role, currentUser.id),
      filters.status ? { status: filters.status } : {},
      filters.responsibleId ? { responsibleId: filters.responsibleId } : {},
      filters.dateFrom ? { becameCustomerAt: { gte: filters.dateFrom } } : {},
      filters.dateTo ? { becameCustomerAt: { lte: filters.dateTo } } : {},
      filters.q
        ? {
            OR: [
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              { contact: { name: { contains: filters.q } } },
              ...(qDigits.length >= 3
                ? [
                    { company: { cnpj: { contains: qDigits } } },
                    { company: { phone: { contains: qDigits } } },
                    { contact: { phone: { contains: qDigits } } },
                    { contact: { whatsapp: { contains: qDigits } } },
                  ]
                : []),
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * CUSTOMERS_PAGE_SIZE,
      take: CUSTOMERS_PAGE_SIZE,
      include: CUSTOMER_INCLUDE,
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: CUSTOMERS_PAGE_SIZE };
}

export async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      ...CUSTOMER_DETAIL_INCLUDE,
      sales: { ...CUSTOMER_DETAIL_INCLUDE.sales, orderBy: { soldAt: "desc" } },
      installations: { ...CUSTOMER_DETAIL_INCLUDE.installations, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getCustomerByCompanyId(companyId: string) {
  return prisma.customer.findUnique({ where: { companyId }, include: CUSTOMER_INCLUDE });
}

export async function getCustomerByContactId(contactId: string) {
  return prisma.customer.findUnique({ where: { contactId }, include: CUSTOMER_INCLUDE });
}

export async function getCustomerActivities(customerId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Customer", entityId: customerId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

// Busca pro cadastro manual de cliente (new-customer-dialog.tsx) — mesmo
// padrão de nome/CNPJ contains já usado em listCompanies (companies/queries.ts).
export async function searchCompaniesForCustomer(q: string) {
  if (!q || q.trim().length < 2) return [];
  const qDigits = onlyDigits(q);

  return prisma.company.findMany({
    where: {
      deletedAt: null,
      OR: [
        { legalName: { contains: q } },
        { tradeName: { contains: q } },
        ...(qDigits.length >= 3 ? [{ cnpj: { contains: qDigits } }] : []),
      ],
    },
    select: { id: true, legalName: true, tradeName: true, cnpj: true },
    take: 10,
    orderBy: { legalName: "asc" },
  });
}

export async function searchContactsForCustomer(q: string) {
  if (!q || q.trim().length < 2) return [];
  const qDigits = onlyDigits(q);

  return prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q } },
        ...(qDigits.length >= 3 ? [{ phone: { contains: qDigits } }, { whatsapp: { contains: qDigits } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
      company: { select: { id: true, legalName: true, tradeName: true } },
    },
    take: 10,
    orderBy: { name: "asc" },
  });
}

import type { Prisma } from "@prisma/client";

const CUSTOMER_INCLUDE = {
  company: {
    select: {
      id: true,
      legalName: true,
      tradeName: true,
      cnpj: true,
      phone: true,
      region: { select: { id: true, name: true, color: true } },
    },
  },
  contact: { select: { id: true, name: true, phone: true, whatsapp: true } },
  responsible: { select: { id: true, name: true } },
  region: { select: { id: true, name: true, color: true } },
} as const;

export type CustomerListItem = Prisma.CustomerGetPayload<{ include: typeof CUSTOMER_INCLUDE }>;

// Só pra tela de detalhe (getCustomer) — a lista (listCustomers) não precisa
// dos contatos da empresa, evita trazer dado a mais numa listagem.
const CUSTOMER_DETAIL_COMPANY_INCLUDE = {
  select: {
    id: true,
    legalName: true,
    tradeName: true,
    cnpj: true,
    phone: true,
    region: { select: { id: true, name: true, color: true } },
    contacts: {
      where: { deletedAt: null },
      orderBy: [
        { isPrimaryContact: "desc" },
        { name: "asc" },
      ] as Prisma.ContactOrderByWithRelationInput[],
    },
  },
} as const;

const CUSTOMER_DETAIL_INCLUDE = {
  ...CUSTOMER_INCLUDE,
  company: CUSTOMER_DETAIL_COMPANY_INCLUDE,
  sales: {
    include: { opportunity: { select: { id: true, title: true } } },
  },
  installations: { include: { stage: true } },
} as const;

export type CustomerDetail = Prisma.CustomerGetPayload<{ include: typeof CUSTOMER_DETAIL_INCLUDE }>;

export { CUSTOMER_DETAIL_COMPANY_INCLUDE, CUSTOMER_DETAIL_INCLUDE, CUSTOMER_INCLUDE };

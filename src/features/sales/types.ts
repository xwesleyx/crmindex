import type { Prisma } from "@prisma/client";

const SALE_INCLUDE = {
  customer: {
    select: {
      id: true,
      company: { select: { id: true, legalName: true, tradeName: true } },
      contact: { select: { id: true, name: true } },
    },
  },
  company: { select: { id: true, legalName: true, tradeName: true } },
  contact: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  owner: { select: { id: true, name: true } },
} as const;

export type SaleListItem = Prisma.SaleGetPayload<{ include: typeof SALE_INCLUDE }>;

export type SaleDetail = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE & { installation: { include: { stage: true } } };
}>;

export { SALE_INCLUDE };

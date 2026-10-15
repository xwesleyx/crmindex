import type { Prisma } from "@prisma/client";

export type CompanyListItem = Prisma.CompanyGetPayload<{
  include: {
    responsible: { select: { id: true; name: true } };
    region: { select: { id: true; name: true; color: true } };
    customer: { select: { id: true; status: true } };
  };
}>;

export type CompanyDetail = Prisma.CompanyGetPayload<{
  include: {
    responsible: { select: { id: true; name: true; email: true } };
    region: { select: { id: true; name: true; color: true } };
    customer: { select: { id: true; status: true; becameCustomerAt: true } };
    contacts: { where: { deletedAt: null } };
  };
}>;

export type CompanyOption = { id: string; legalName: string; tradeName: string | null };

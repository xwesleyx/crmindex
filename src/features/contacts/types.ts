import type { Prisma } from "@prisma/client";

export type ContactListItem = Prisma.ContactGetPayload<{
  include: {
    responsible: { select: { id: true; name: true } };
    company: { select: { id: true; legalName: true; tradeName: true } };
  };
}>;

export type ContactOption = { id: string; name: string; companyId: string | null };

export type ContactDetail = Prisma.ContactGetPayload<{
  include: {
    responsible: { select: { id: true; name: true; email: true } };
    company: { select: { id: true; legalName: true; tradeName: true } };
  };
}>;

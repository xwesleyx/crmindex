import type { Prisma } from "@prisma/client";

export type LeadListItem = Prisma.LeadGetPayload<{
  include: { responsible: { select: { id: true; name: true } } };
}>;

export type LeadDetail = Prisma.LeadGetPayload<{
  include: { responsible: { select: { id: true; name: true; email: true } } };
}>;

export type AssignableUser = { id: string; name: string; role: string };

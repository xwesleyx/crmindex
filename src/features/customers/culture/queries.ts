import { prisma } from "@/lib/prisma";

export type CustomerCulture = {
  customerId: string;
  content: string | null;
  alert: string | null;
  updatedAt: Date | null;
  updatedByName: string | null;
};

export const CULTURE_SELECT = {
  id: true,
  cultureContent: true,
  cultureAlert: true,
  cultureUpdatedAt: true,
  cultureUpdatedBy: { select: { name: true } },
} as const;

export function toCustomerCulture(customer: {
  id: string;
  cultureContent: string | null;
  cultureAlert: string | null;
  cultureUpdatedAt: Date | null;
  cultureUpdatedBy: { name: string } | null;
}): CustomerCulture {
  return {
    customerId: customer.id,
    content: customer.cultureContent,
    alert: customer.cultureAlert,
    updatedAt: customer.cultureUpdatedAt,
    updatedByName: customer.cultureUpdatedBy?.name ?? null,
  };
}

export async function getCustomerCulture(customerId: string): Promise<CustomerCulture | null> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: CULTURE_SELECT });
  return customer ? toCustomerCulture(customer) : null;
}

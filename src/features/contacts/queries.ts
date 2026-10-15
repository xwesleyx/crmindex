import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { contactWhereForRole } from "@/features/contacts/permissions";
import type { ContactFilters } from "@/features/contacts/schema";

export const CONTACTS_PAGE_SIZE = 20;

const LIST_INCLUDE = {
  responsible: { select: { id: true, name: true } },
  company: { select: { id: true, legalName: true, tradeName: true } },
} as const;

export async function listContacts(
  filters: ContactFilters,
  currentUser: { id: string; role: UserRole }
) {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";

  const where: Prisma.ContactWhereInput = {
    AND: [
      contactWhereForRole(currentUser.role, currentUser.id),
      filters.includeArchived ? {} : { deletedAt: null },
      filters.origin ? { origin: filters.origin } : {},
      filters.companyId ? { companyId: filters.companyId } : {},
      filters.responsibleId ? { responsibleId: filters.responsibleId } : {},
      filters.q
        ? {
            OR: [
              { name: { contains: filters.q } },
              { email: { contains: filters.q } },
              { company: { legalName: { contains: filters.q } } },
              { company: { tradeName: { contains: filters.q } } },
              ...(qDigits.length >= 3
                ? [{ phone: { contains: qDigits } }, { whatsapp: { contains: qDigits } }]
                : []),
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { [filters.sort]: filters.dir },
      skip: (filters.page - 1) * CONTACTS_PAGE_SIZE,
      take: CONTACTS_PAGE_SIZE,
      include: LIST_INCLUDE,
    }),
    prisma.contact.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: CONTACTS_PAGE_SIZE };
}

export async function getContact(id: string) {
  return prisma.contact.findUnique({
    where: { id },
    include: {
      responsible: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, legalName: true, tradeName: true } },
    },
  });
}

// Prioridade telefone → WhatsApp → e-mail (seção 6 do escopo).
export async function findContactDuplicate(params: {
  phone?: string;
  whatsapp?: string;
  email?: string;
  excludeId?: string;
}) {
  const { phone, whatsapp, email, excludeId } = params;

  if (phone) {
    const match = await prisma.contact.findFirst({
      where: { phone, id: excludeId ? { not: excludeId } : undefined },
      include: LIST_INCLUDE,
    });
    if (match) return match;
  }

  if (whatsapp) {
    const match = await prisma.contact.findFirst({
      where: { whatsapp, id: excludeId ? { not: excludeId } : undefined },
      include: LIST_INCLUDE,
    });
    if (match) return match;
  }

  if (email) {
    const match = await prisma.contact.findFirst({
      where: { email, id: excludeId ? { not: excludeId } : undefined },
      include: LIST_INCLUDE,
    });
    if (match) return match;
  }

  return null;
}

export async function listContactOptions() {
  return prisma.contact.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, companyId: true },
    orderBy: { name: "asc" },
  });
}

export async function getContactActivities(contactId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Contact", entityId: contactId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

// Tudo que está ligado ao contato, pra tela de detalhe: empresa completa,
// cadastro de cliente, os últimos registros comerciais e os últimos 10
// atendimentos (pedido: "os últimos atendimentos daquele contato, máximo 10").
const RELATED_LIMIT = 5;
export const CONTACT_RECENT_CONVERSATIONS_LIMIT = 10;

export async function getContactOverview(contactId: string) {
  const [company, customer, opportunities, sales, installations, conversations, counts] = await Promise.all([
    prisma.contact
      .findUnique({ where: { id: contactId }, select: { company: true } })
      .then((row) => row?.company ?? null),
    prisma.customer.findUnique({
      where: { contactId },
      select: { id: true, status: true, becameCustomerAt: true, region: { select: { name: true } } },
    }),
    prisma.opportunity.findMany({
      where: { contactId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: RELATED_LIMIT,
      select: {
        id: true,
        title: true,
        status: true,
        estimatedValueCents: true,
        createdAt: true,
        stage: { select: { name: true } },
      },
    }),
    prisma.sale.findMany({
      where: { contactId },
      orderBy: { soldAt: "desc" },
      take: RELATED_LIMIT,
      select: { id: true, status: true, amountCents: true, soldAt: true },
    }),
    prisma.installation.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: RELATED_LIMIT,
      select: { id: true, status: true, scheduledAt: true, createdAt: true, stage: { select: { name: true } } },
    }),
    prisma.conversation.findMany({
      where: { contactId },
      orderBy: { lastMessageAt: "desc" },
      take: CONTACT_RECENT_CONVERSATIONS_LIMIT,
      select: {
        id: true,
        status: true,
        queue: true,
        channel: true,
        assigneeId: true,
        createdAt: true,
        closedAt: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        assignee: { select: { name: true } },
        _count: { select: { messages: { where: { internal: false } } } },
      },
    }),
    prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        _count: {
          select: {
            opportunities: { where: { deletedAt: null } },
            sales: true,
            installations: true,
            conversations: true,
            leadsConvertedTo: true,
          },
        },
      },
    }),
  ]);

  return {
    company,
    customer,
    opportunities,
    sales,
    installations,
    conversations,
    counts: counts?._count ?? { opportunities: 0, sales: 0, installations: 0, conversations: 0, leadsConvertedTo: 0 },
  };
}

export type ContactOverview = Awaited<ReturnType<typeof getContactOverview>>;

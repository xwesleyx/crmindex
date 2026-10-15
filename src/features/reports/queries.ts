import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { conversationRegionWhere } from "@/features/regions/query-helpers";
import { onlyDigits } from "@/lib/validators";
import type { ReportsFilters } from "@/features/reports/schema";

const PAGE_SIZE = 20;

export const REPORT_LIST_INCLUDE = {
  contact: {
    select: {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
      company: { select: { id: true, legalName: true, tradeName: true } },
    },
  },
  assignee: { select: { id: true, name: true } },
} as const satisfies Prisma.ConversationInclude;

export type ReportConversationItem = Prisma.ConversationGetPayload<{
  include: typeof REPORT_LIST_INCLUDE;
}>;

// Ao contrário de listConversations (atendimento/queries.ts), aqui NÃO
// exclui encerradas — Relatórios é justamente onde elas ficam visíveis e
// pesquisáveis depois de sumirem da Central.
export async function listConversationsForReport(filters: ReportsFilters, regionIds: string[] | null = null) {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";
  const page = filters.page ?? 1;

  const where: Prisma.ConversationWhereInput = {
    AND: [
      conversationRegionWhere(regionIds),
      filters.status === "active"
        ? { status: { notIn: ["RESOLVED", "CLOSED"] } }
        : filters.status === "closed"
          ? { status: { in: ["RESOLVED", "CLOSED"] } }
          : {},
      filters.assigneeId ? { assigneeId: filters.assigneeId } : {},
      filters.contactId ? { contactId: filters.contactId } : {},
      filters.companyId ? { contact: { companyId: filters.companyId } } : {},
      filters.dateFrom ? { lastMessageAt: { gte: new Date(filters.dateFrom) } } : {},
      filters.dateTo ? { lastMessageAt: { lte: new Date(`${filters.dateTo}T23:59:59.999`) } } : {},
      filters.q
        ? {
            OR: [
              { contact: { name: { contains: filters.q } } },
              { contact: { company: { legalName: { contains: filters.q } } } },
              { contact: { company: { tradeName: { contains: filters.q } } } },
              { lastMessagePreview: { contains: filters.q } },
              { messages: { some: { content: { contains: filters.q } } } },
              ...(qDigits.length >= 3
                ? [
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
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: REPORT_LIST_INCLUDE,
    }),
    prisma.conversation.count({ where }),
  ]);

  return { items, total, page, pageSize: PAGE_SIZE };
}

// Pro filtro de Contato/Empresa (entity-search-filter.tsx) reexibir o nome
// já escolhido quando a página recarrega — a URL só guarda o id.
export async function getContactLabelForFilter(id: string) {
  const contact = await prisma.contact.findUnique({ where: { id }, select: { name: true } });
  return contact?.name ?? null;
}

export async function getCompanyLabelForFilter(id: string) {
  const company = await prisma.company.findUnique({
    where: { id },
    select: { legalName: true, tradeName: true },
  });
  return company ? company.tradeName || company.legalName : null;
}

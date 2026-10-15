import type { Prisma } from "@prisma/client";

export const CONVERSATION_LIST_INCLUDE = {
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

export type ConversationListItem = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_LIST_INCLUDE;
}>;

// Cultura/Modelo do cliente (aba da ficha do cliente) — mostrada no
// Atendimento: faixa de aviso no chat + documento num pop-up. Ver
// conversation-culture.ts pra ordem de busca do cliente.
const CULTURE_FIELDS = {
  cultureContent: true,
  cultureAlert: true,
  cultureUpdatedAt: true,
  cultureUpdatedBy: { select: { name: true } },
} as const;

export const CONVERSATION_DETAIL_INCLUDE = {
  contact: {
    include: {
      company: {
        include: {
          customer: { select: { id: true, status: true, ...CULTURE_FIELDS } },
        },
      },
      customer: { select: { id: true, ...CULTURE_FIELDS } },
      responsible: { select: { id: true, name: true } },
    },
  },
  assignee: { select: { id: true, name: true } },
  // Atendentes extras ("Participar") — o userId também alimenta
  // canEditConversation.
  participants: {
    select: { userId: true, user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  },
  lead: { select: { id: true, name: true, status: true } },
  opportunity: {
    select: {
      id: true,
      title: true,
      estimatedValueCents: true,
      recurringValueCents: true,
      status: true,
      stage: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  },
  customer: {
    select: {
      id: true,
      status: true,
      becameCustomerAt: true,
      ...CULTURE_FIELDS,
      responsible: { select: { id: true, name: true } },
      installations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          priority: true,
          dueAt: true,
          responsible: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
          checklistItems: { select: { id: true, completed: true, required: true } },
        },
      },
    },
  },
} as const satisfies Prisma.ConversationInclude;

export type ConversationDetail = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_DETAIL_INCLUDE;
}>;

export const MESSAGE_INCLUDE = {
  senderUser: { select: { id: true, name: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      type: true,
      direction: true,
      senderUser: { select: { id: true, name: true } },
    },
  },
} as const satisfies Prisma.MessageInclude;

export type MessageItem = Prisma.MessageGetPayload<{
  include: typeof MESSAGE_INCLUDE;
}>;

// Encerradas nunca aparecem na Central (queries.ts) — não tem filtro
// "closed" aqui de propósito; consultar atendimentos encerrados é papel do
// módulo Relatórios (reports/queries.ts).
export type ConversationFilterKey =
  | "all"
  | "unread"
  | "mine"
  | "unassigned"
  | "waiting_customer"
  | "waiting_internal"
  | "in_progress";

export type ConversationSortKey = "recent" | "oldest" | "unread_first" | "waiting_first";

export const CONVERSATION_HISTORY_INCLUDE = {
  assignee: { select: { id: true, name: true } },
} as const satisfies Prisma.ConversationInclude;

// "Conversas anteriores" do mesmo contato (seção 9 do adendo).
export type ConversationHistoryItem = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_HISTORY_INCLUDE;
}>;

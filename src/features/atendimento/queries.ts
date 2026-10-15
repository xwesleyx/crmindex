import type { Prisma } from "@prisma/client";
import { endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";

import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { conversationWhereForViewer, whereAttendedBy, type AtendimentoViewer } from "@/features/atendimento/permissions";
import {
  CONVERSATION_DETAIL_INCLUDE,
  CONVERSATION_HISTORY_INCLUDE,
  CONVERSATION_LIST_INCLUDE,
  MESSAGE_INCLUDE,
  type ConversationFilterKey,
  type ConversationSortKey,
} from "@/features/atendimento/types";

export const CONVERSATIONS_PAGE_SIZE = 30;

function whereForFilter(
  filter: ConversationFilterKey,
  currentUser: { id: string }
): Prisma.ConversationWhereInput {
  switch (filter) {
    case "unread":
      // Só as não lidas das conversas que EU estou atendendo (responsável ou
      // participante) — as dos outros não são problema meu.
      return { AND: [whereAttendedBy(currentUser.id), { unreadCount: { gt: 0 } }] };
    case "mine":
      return whereAttendedBy(currentUser.id);
    case "unassigned":
      return { assigneeId: null };
    case "waiting_customer":
      return { status: "WAITING_CUSTOMER" };
    case "waiting_internal":
      // Mesma semântica de getConversationDisplayStatus (atendimento/labels.ts):
      // "Aguardando atendimento" é toda conversa ativa sem responsável, não
      // só quem tem o status literal WAITING_INTERNAL (que raramente é usado
      // manualmente).
      return { assigneeId: null, status: { in: ["OPEN", "WAITING_INTERNAL"] } };
    case "in_progress":
      // "Em atendimento" (labels.ts): tem responsável e ainda está ativa.
      return { assigneeId: { not: null }, status: { in: ["OPEN", "WAITING_INTERNAL"] } };
    case "all":
    default:
      return {};
  }
}

function orderByForSort(sort: ConversationSortKey): Prisma.ConversationOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ lastMessageAt: "asc" }];
    case "unread_first":
      return [{ unreadCount: "desc" }, { lastMessageAt: "desc" }];
    case "waiting_first":
      // SQLite ordena NULL antes dos demais em ASC — sem responsável vem primeiro.
      return [{ assigneeId: "asc" }, { lastMessageAt: "desc" }];
    case "recent":
    default:
      return [{ lastMessageAt: "desc" }];
  }
}

// Contagem de cada status DENTRO da aba aberta (Minhas/Não lidas/Novas) —
// os números do painel Status batem com o que a lista mostra ao clicar.
export async function countStatusesForTab(filter: ConversationFilterKey, currentUser: AtendimentoViewer) {
  const base: Prisma.ConversationWhereInput[] = [
    { status: { notIn: ["RESOLVED", "CLOSED"] } },
    conversationWhereForViewer(currentUser),
    whereForFilter(filter, currentUser),
  ];
  const [inProgress, waitingCustomer] = await Promise.all([
    prisma.conversation.count({ where: { AND: [...base, whereForFilter("in_progress", currentUser)] } }),
    prisma.conversation.count({ where: { AND: [...base, whereForFilter("waiting_customer", currentUser)] } }),
  ]);
  return { inProgress, waitingCustomer };
}

export async function listConversations(
  filters: {
    q?: string;
    filter: ConversationFilterKey;
    status?: ("in_progress" | "waiting_customer")[];
    sort?: ConversationSortKey;
  },
  currentUser: AtendimentoViewer
) {
  const qDigits = filters.q ? onlyDigits(filters.q) : "";

  const where: Prisma.ConversationWhereInput = {
    AND: [
      // Encerradas somem da Central pra todo mundo (seção "Relatórios" é o
      // lugar certo pra revisitar atendimentos já fechados) — não é mais um
      // filtro opcional aqui, é sempre excluído.
      { status: { notIn: ["RESOLVED", "CLOSED"] } },
      conversationWhereForViewer(currentUser),
      whereForFilter(filters.filter, currentUser),
      filters.status ? { OR: filters.status.map((status) => whereForFilter(status, currentUser)) } : {},
      filters.q
        ? {
            OR: [
              { contact: { name: { contains: filters.q } } },
              { contact: { company: { legalName: { contains: filters.q } } } },
              { contact: { company: { tradeName: { contains: filters.q } } } },
              { contact: { company: { cnpj: { contains: filters.q } } } },
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

  return prisma.conversation.findMany({
    where,
    orderBy: orderByForSort(filters.sort ?? "recent"),
    take: CONVERSATIONS_PAGE_SIZE,
    include: CONVERSATION_LIST_INCLUDE,
  });
}

export async function getConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: CONVERSATION_DETAIL_INCLUDE,
  });
}

export async function getConversationMessages(conversationId: string, afterId?: string) {
  if (afterId) {
    const cursor = await prisma.message.findUnique({ where: { id: afterId }, select: { createdAt: true } });
    if (!cursor) return [];
    return prisma.message.findMany({
      where: { conversationId, createdAt: { gt: cursor.createdAt } },
      orderBy: { createdAt: "asc" },
      include: MESSAGE_INCLUDE,
    });
  }

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: MESSAGE_INCLUDE,
  });
}

// "Conversas anteriores" (seção 9) — outros atendimentos do mesmo contato,
// pra o atendente saber "já tivemos contato antes?" sem sair da conversa.
// "Assinatura" barata da lista visível ao usuário — usada só pra decidir se
// vale a pena um router.refresh() completo (que reexecuta listConversations,
// getAtendimentoMetrics etc.) a cada 5s de polling (conversation-list.tsx).
// Um único aggregate (contagem + updatedAt mais recente + soma de não lidas)
// muda sempre que algo relevante muda (mensagem nova, conversa nova,
// encerramento, reatribuição — todos tocam updatedAt via @updatedAt) sem
// precisar buscar a lista inteira pra comparar.
export async function getConversationListSignature(currentUser: AtendimentoViewer): Promise<string> {
  const where: Prisma.ConversationWhereInput = {
    AND: [{ status: { notIn: ["RESOLVED", "CLOSED"] } }, conversationWhereForViewer(currentUser)],
  };

  const aggregate = await prisma.conversation.aggregate({
    where,
    _count: { _all: true },
    _max: { updatedAt: true },
    _sum: { unreadCount: true },
  });

  return `${aggregate._count._all}:${aggregate._max.updatedAt?.getTime() ?? 0}:${aggregate._sum.unreadCount ?? 0}`;
}

export async function listConversationsForContact(contactId: string, excludeConversationId: string) {
  return prisma.conversation.findMany({
    where: { contactId, id: { not: excludeConversationId } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: CONVERSATION_HISTORY_INCLUDE,
  });
}

export async function getConversationActivities(conversationId: string) {
  return prisma.activity.findMany({
    where: { entityType: "Conversation", entityId: conversationId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

// Papéis que atendem conversas (seção 18 — Atendimento entra no elenco de
// responsáveis possíveis, diferente de listAssignableUsers do CRM que só
// oferece ADMIN/GERENTE/VENDEDOR).
export async function listAtendimentoAssignableUsers() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["ADMIN", "GERENTE", "VENDEDOR", "ATENDIMENTO"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

// Métricas simples do topo da Central (seção 19: "não criar um dashboard
// gigantesco").
export async function getAtendimentoMetrics(currentUser: AtendimentoViewer) {
  const scope = conversationWhereForViewer(currentUser);
  const activeStatuses = ["OPEN", "WAITING_INTERNAL"] as const;

  // Encerradas nunca contam aqui — os botões/contadores da Central só
  // representam o que a lista realmente mostra (listConversations exclui
  // RESOLVED/CLOSED incondicionalmente).
  const notClosed: Prisma.ConversationWhereInput = { status: { notIn: ["RESOLVED", "CLOSED"] } };

  const [open, unread, unassigned, waitingInternal, inProgress, waitingCustomer, mine] =
    await Promise.all([
      prisma.conversation.count({
        where: { AND: [scope, notClosed, { status: { in: ["OPEN", "WAITING_CUSTOMER", "WAITING_INTERNAL"] } }] },
      }),
      prisma.conversation.count({
        where: { AND: [scope, notClosed, whereAttendedBy(currentUser.id), { unreadCount: { gt: 0 } }] },
      }),
      prisma.conversation.count({ where: { AND: [scope, notClosed, { assigneeId: null }] } }),
      // Mesma semântica de getConversationDisplayStatus (labels.ts): sem
      // responsável e ainda ativa — não o status cru WAITING_INTERNAL.
      prisma.conversation.count({
        where: { AND: [scope, { assigneeId: null }, { status: { in: [...activeStatuses] } }] },
      }),
      prisma.conversation.count({
        where: { AND: [scope, { assigneeId: { not: null } }, { status: { in: [...activeStatuses] } }] },
      }),
      prisma.conversation.count({ where: { AND: [scope, { status: "WAITING_CUSTOMER" }] } }),
      prisma.conversation.count({
        where: {
          AND: [
            scope,
            notClosed,
            whereAttendedBy(currentUser.id),
            { status: { in: ["OPEN", "WAITING_CUSTOMER", "WAITING_INTERNAL"] } },
          ],
        },
      }),
    ]);

  return { open, unread, unassigned, waitingInternal, inProgress, waitingCustomer, mine };
}

export type AttendanceLeaderboardEntry = { userId: string; name: string; count: number };

// Janela de horário comercial mostrada no gráfico por hora do painel de TV
// (07h-20h) — cobre o expediente sem poluir o gráfico com madrugada vazia.
const DASHBOARD_HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

// Painel de TV da Central de Atendimento (seção "Dashboard" no lugar de
// Tickets, que nunca teve backend). Diferente de getAtendimentoMetrics
// (escopado por usuário, pro topo da Central), este é sempre a visão da
// equipe inteira — é pensado pra ficar numa tela do escritório, então faz
// sentido mostrar o total de todo mundo, não só o que o usuário logado vê.
export async function getAtendimentoDashboard() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const activeStatuses: Prisma.ConversationWhereInput = {
    status: { in: ["OPEN", "WAITING_CUSTOMER", "WAITING_INTERNAL"] },
  };

  const [closedToday, openedToday, activeNow, unassignedNow, unreadNow] = await Promise.all([
    prisma.conversation.findMany({
      where: { closedAt: { gte: todayStart, lte: todayEnd } },
      select: {
        createdAt: true,
        closedAt: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.conversation.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
    prisma.conversation.count({ where: activeStatuses }),
    prisma.conversation.count({ where: { AND: [activeStatuses, { assigneeId: null }] } }),
    prisma.conversation.count({ where: { AND: [activeStatuses, { unreadCount: { gt: 0 } }] } }),
  ]);

  // Ranking de quem mais encerrou atendimento hoje — feito em JS (mesmo
  // padrão de getSalesEvolution/getPipelineByStage: busca os registros brutos
  // uma vez, agrega aqui) em vez de um groupBy separado, já que os mesmos
  // registros também alimentam o gráfico por hora e o tempo médio abaixo.
  const byAssignee = new Map<string, AttendanceLeaderboardEntry>();
  for (const c of closedToday) {
    if (!c.assignee) continue;
    const entry = byAssignee.get(c.assignee.id) ?? { userId: c.assignee.id, name: c.assignee.name, count: 0 };
    entry.count += 1;
    byAssignee.set(c.assignee.id, entry);
  }
  const leaderboard = Array.from(byAssignee.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const hourly = DASHBOARD_HOURS.map((hour) => ({
    hour,
    count: closedToday.filter((c) => c.closedAt && c.closedAt.getHours() === hour).length,
  }));

  const durationsMinutes = closedToday.map(
    (c) => (c.closedAt!.getTime() - c.createdAt.getTime()) / 60000
  );
  const avgMinutes = durationsMinutes.length
    ? durationsMinutes.reduce((sum, d) => sum + d, 0) / durationsMinutes.length
    : null;

  return {
    closedTodayCount: closedToday.length,
    openedToday,
    activeNow,
    unassignedNow,
    unreadNow,
    leaderboard,
    hourly,
    avgMinutes,
  };
}

export type TopAttendantEntry = { userId: string; name: string; monthCount: number; totalCount: number };

// Quadro dos 5 atendentes que mais atenderam (painel de TV) — ranking pelo
// total histórico de atendimentos encerrados, com o número do mês atual ao
// lado pra comparar "sempre" com "agora" sem duas telas separadas. groupBy
// (em vez de trazer toda conversa encerrada e somar em JS, como o
// leaderboard de hoje acima) porque aqui o histórico é ilimitado — não dá
// pra carregar tudo pra memória só pra contar.
export async function getTopAttendants(limit = 5): Promise<TopAttendantEntry[]> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [monthGroups, totalGroups] = await Promise.all([
    prisma.conversation.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, closedAt: { gte: monthStart, lte: monthEnd } },
      _count: true,
    }),
    prisma.conversation.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, closedAt: { not: null } },
      _count: true,
    }),
  ]);

  const monthMap = new Map(monthGroups.map((g) => [g.assigneeId as string, g._count]));
  const totalMap = new Map(totalGroups.map((g) => [g.assigneeId as string, g._count]));
  const userIds = Array.from(new Set([...monthMap.keys(), ...totalMap.keys()]));
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return userIds
    .map((userId) => ({
      userId,
      name: nameById.get(userId) ?? "—",
      monthCount: monthMap.get(userId) ?? 0,
      totalCount: totalMap.get(userId) ?? 0,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, limit);
}

// Busca de clientes pro botão "[+ Vincular a cliente]" (seção 6) do banner
// de número não identificado — por nome fantasia, razão social ou CNPJ.
export async function searchCustomersForLinking(q: string) {
  if (!q || q.trim().length < 2) return [];
  const qDigits = onlyDigits(q);

  return prisma.customer.findMany({
    where: {
      OR: [
        { company: { legalName: { contains: q } } },
        { company: { tradeName: { contains: q } } },
        { contact: { name: { contains: q } } },
        ...(qDigits.length >= 3 ? [{ company: { cnpj: { contains: qDigits } } }] : []),
      ],
    },
    select: {
      id: true,
      status: true,
      company: { select: { id: true, legalName: true, tradeName: true, cnpj: true } },
      contact: { select: { id: true, name: true } },
    },
    take: 10,
  });
}

// Busca de contatos existentes para o diálogo "Nova conversa" — evita criar
// contato duplicado quando o atendente já sabe quem é a pessoa (seção 5:
// "evitar duplicação de contatos").
export async function searchContactsForConversation(q: string) {
  if (!q || q.trim().length < 2) return [];
  const qDigits = onlyDigits(q);

  return prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q } },
        { company: { legalName: { contains: q } } },
        ...(qDigits.length >= 3
          ? [{ phone: { contains: qDigits } }, { whatsapp: { contains: qDigits } }]
          : []),
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

// Quadro (Kanban) da Central: por atendente, três colunas — Em atendimento,
// Aguardando cliente e Finalizados HOJE. Sem "Ver atendimento de todos", a
// pessoa só vê o que ela atende (responsável ou participante); com a
// permissão, vê de todo mundo e pode filtrar por um atendente.
const BOARD_COLUMN_LIMIT = 100;

export const BOARD_CARD_SELECT = {
  id: true,
  status: true,
  priority: true,
  queue: true,
  assigneeId: true,
  unreadCount: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  createdAt: true,
  closedAt: true,
  contact: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  participants: { select: { userId: true, user: { select: { name: true } } } },
} satisfies Prisma.ConversationSelect;

export type BoardCard = Prisma.ConversationGetPayload<{ select: typeof BOARD_CARD_SELECT }>;

export async function getAtendimentoBoard(viewer: AtendimentoViewer, attendantId: string | null) {
  // Sem a permissão, o filtro de atendente é sempre a própria pessoa.
  const effectiveAttendant = viewer.viewAll ? attendantId : viewer.id;
  const scope: Prisma.ConversationWhereInput = effectiveAttendant
    ? whereAttendedBy(effectiveAttendant)
    : { assigneeId: { not: null } };

  const startOfToday = startOfDay(new Date());

  const [queue, inProgress, waitingCustomer, closedToday] = await Promise.all([
    // Na fila: aberta e sem ninguém atendendo. Não tem atendente, então não
    // depende do filtro — é a fila de todo mundo (quem espera há mais tempo
    // primeiro).
    prisma.conversation.findMany({
      where: { assigneeId: null, status: { notIn: ["CLOSED", "RESOLVED"] } },
      select: BOARD_CARD_SELECT,
      orderBy: { lastMessageAt: "asc" },
      take: BOARD_COLUMN_LIMIT,
    }),
    prisma.conversation.findMany({
      where: { AND: [scope, { status: { in: ["OPEN", "WAITING_INTERNAL"] } }] },
      select: BOARD_CARD_SELECT,
      orderBy: { lastMessageAt: "desc" },
      take: BOARD_COLUMN_LIMIT,
    }),
    prisma.conversation.findMany({
      where: { AND: [scope, { status: "WAITING_CUSTOMER" }] },
      select: BOARD_CARD_SELECT,
      orderBy: { lastMessageAt: "desc" },
      take: BOARD_COLUMN_LIMIT,
    }),
    prisma.conversation.findMany({
      where: { AND: [scope, { status: { in: ["CLOSED", "RESOLVED"] } }, { closedAt: { gte: startOfToday } }] },
      select: BOARD_CARD_SELECT,
      orderBy: { closedAt: "desc" },
      take: BOARD_COLUMN_LIMIT,
    }),
  ]);

  return { queue, inProgress, waitingCustomer, closedToday };
}

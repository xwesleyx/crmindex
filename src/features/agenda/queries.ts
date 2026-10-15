import type { Task, UserRole } from "@prisma/client";
import { startOfDay } from "date-fns";

import { prisma } from "@/lib/prisma";
import { canAccessModule } from "@/lib/permissions";
import { installationWhereForRole } from "@/features/installations/permissions";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { leadWhereForRole } from "@/features/leads/permissions";
import type { AgendaCategory, AgendaEvent } from "@/features/agenda/types";
import { occurrencesBetween } from "@/features/tasks/recurrence";

function categoryForEntityType(entityType: string): AgendaCategory | null {
  if (entityType === "Conversation") return "atendimento";
  if (entityType === "Opportunity" || entityType === "Lead") return "crm";
  if (entityType === "Installation") return "instalacao";
  if (entityType === "General") return "geral";
  return null;
}

// ADMIN/GERENTE veem tudo; os demais só o que é seu — mesmo princípio já
// usado em todo módulo com "responsável" (conversationWhereForRole,
// leadWhereForRole, installationWhereForRole...). Task não tem esse helper
// próprio (é polimórfica, não vale a pena um permissions.ts só pra isso).
export function canViewAllTasks(role: UserRole): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

type TaskWithAssignee = Task & { assignee: { id: string; name: string } | null };

// Contexto de cada Task (título/link) depende de quem é a entidade dona —
// resolve em lote por entityType em vez de 1 query por tarefa (mesmo
// princípio de "nunca N+1" já usado no resto do sistema). Compartilhado entre
// getAgendaEvents (tarefas dentro do período selecionado) e
// getPendingTaskEvents (tarefas atrasadas/sem prazo, seção "Pendentes").
async function resolveTaskEvents(tasks: TaskWithAssignee[]): Promise<AgendaEvent[]> {
  const conversationIds = tasks.filter((t) => t.entityType === "Conversation").map((t) => t.entityId);
  const opportunityIds = tasks.filter((t) => t.entityType === "Opportunity").map((t) => t.entityId);
  const leadIds = tasks.filter((t) => t.entityType === "Lead").map((t) => t.entityId);
  const installationIds = tasks.filter((t) => t.entityType === "Installation").map((t) => t.entityId);

  const [conversationsById, opportunitiesById, leadsById, installationsById] = await Promise.all([
    conversationIds.length === 0
      ? new Map()
      : prisma.conversation
          .findMany({ where: { id: { in: conversationIds } }, include: { contact: true } })
          .then((rows) => new Map(rows.map((r) => [r.id, r]))),
    opportunityIds.length === 0
      ? new Map()
      : prisma.opportunity
          .findMany({ where: { id: { in: opportunityIds } }, select: { id: true, title: true } })
          .then((rows) => new Map(rows.map((r) => [r.id, r]))),
    leadIds.length === 0
      ? new Map()
      : prisma.lead
          .findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })
          .then((rows) => new Map(rows.map((r) => [r.id, r]))),
    installationIds.length === 0
      ? new Map()
      : prisma.installation
          .findMany({
            where: { id: { in: installationIds } },
            include: { customer: { include: { company: true, contact: true } } },
          })
          .then((rows) => new Map(rows.map((r) => [r.id, r]))),
  ]);

  return tasks.map((task) => {
    const category = categoryForEntityType(task.entityType);
    let subtitle: string | null = null;
    let href = "/agenda";

    if (task.entityType === "Conversation") {
      const conversation = conversationsById.get(task.entityId);
      subtitle = conversation ? conversation.contact.name : null;
      href = `/atendimento/${task.entityId}`;
    } else if (task.entityType === "Opportunity") {
      const opportunity = opportunitiesById.get(task.entityId);
      subtitle = opportunity ? opportunity.title : null;
      href = `/crm/oportunidades/${task.entityId}`;
    } else if (task.entityType === "Lead") {
      const lead = leadsById.get(task.entityId);
      subtitle = lead ? lead.name : null;
      href = `/crm/leads/${task.entityId}`;
    } else if (task.entityType === "Installation") {
      const installation = installationsById.get(task.entityId);
      subtitle = installation ? getCustomerDisplayName(installation.customer) : null;
      href = `/instalacoes/${task.entityId}`;
    }

    return {
      id: `task:${task.id}`,
      category: category ?? "crm",
      title: task.title,
      subtitle,
      when: task.dueAt ?? task.createdAt,
      responsibleName: task.assignee?.name ?? null,
      responsibleId: task.assigneeId,
      href,
      done: task.status === "CONCLUIDA",
      source: "task" as const,
      dueAt: task.dueAt,
      taskId: task.id,
      durationMinutes: task.durationMinutes,
      recurrence: task.recurrence,
    };
  });
}

// Painel "Agenda" (visão tipo Google Agenda — seção do pedido): junta
// Task.dueAt (qualquer entidade dona), Installation.scheduledAt e
// Lead.nextActionAt num só feed ordenado por horário. Cada categoria só
// entra se o usuário tiver acesso ao módulo dono (um Vendedor sem acesso a
// "instalacoes" não vê compromissos de instalação aqui, mesmo que peça).
export async function getAgendaEvents(
  filters: { categories: AgendaCategory[]; from: Date; to: Date; responsibleId?: string | null },
  currentUser: { id: string; role: UserRole }
): Promise<AgendaEvent[]> {
  // Filtro por pessoa só vale pra quem vê a agenda de todos.
  const person = canViewAllTasks(currentUser.role) ? (filters.responsibleId ?? null) : null;
  const wantsAtendimento =
    filters.categories.includes("atendimento") && canAccessModule(currentUser.role, "atendimento");
  const wantsCrm = filters.categories.includes("crm") && canAccessModule(currentUser.role, "crm");
  const wantsInstalacao =
    filters.categories.includes("instalacao") && canAccessModule(currentUser.role, "instalacoes");
  // "Geral" não tem módulo dono — é a própria Agenda (já gated na página) —
  // então não passa por canAccessModule, só pelo toggle de categoria.
  const wantsGeral = filters.categories.includes("geral");

  const taskEntityTypes = [
    ...(wantsAtendimento ? ["Conversation"] : []),
    ...(wantsCrm ? ["Opportunity", "Lead"] : []),
    ...(wantsInstalacao ? ["Installation"] : []),
    ...(wantsGeral ? ["General"] : []),
  ];

  const taskWhere = canViewAllTasks(currentUser.role)
    ? {}
    : { OR: [{ assigneeId: currentUser.id }, { assigneeId: null }] };

  const [tasks, recurringTasks, installations, leads] = await Promise.all([
    taskEntityTypes.length === 0
      ? []
      : prisma.task.findMany({
          where: {
            AND: [
              taskWhere,
              person ? { assigneeId: person } : {},
              { entityType: { in: taskEntityTypes } },
              { dueAt: { gte: filters.from, lte: filters.to } },
            ],
          },
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { dueAt: "asc" },
        }),
    // Séries que repetem e começaram antes do fim do período: as próximas
    // ocorrências caem dentro dele e aparecem nos dias certos.
    taskEntityTypes.length === 0
      ? []
      : prisma.task.findMany({
          where: {
            AND: [
              taskWhere,
              person ? { assigneeId: person } : {},
              { entityType: { in: taskEntityTypes } },
              { recurrence: { not: null } },
              { status: { not: "CONCLUIDA" } },
              { dueAt: { not: null, lte: filters.to } },
            ],
          },
          include: { assignee: { select: { id: true, name: true } } },
        }),
    wantsInstalacao
      ? prisma.installation.findMany({
          where: {
            AND: [
              installationWhereForRole(currentUser.role, currentUser.id),
              person ? { responsibleId: person } : {},
              { scheduledAt: { gte: filters.from, lte: filters.to } },
            ],
          },
          include: {
            responsible: { select: { id: true, name: true } },
            customer: { include: { company: true, contact: true } },
          },
          orderBy: { scheduledAt: "asc" },
        })
      : [],
    wantsCrm
      ? prisma.lead.findMany({
          where: {
            AND: [
              leadWhereForRole(currentUser.role, currentUser.id),
              person ? { responsibleId: person } : {},
              { nextActionAt: { gte: filters.from, lte: filters.to } },
              { deletedAt: null },
            ],
          },
          include: { responsible: { select: { id: true, name: true } } },
          orderBy: { nextActionAt: "asc" },
        })
      : [],
  ]);

  const taskEvents = await resolveTaskEvents(tasks.filter((task) => task.dueAt));
  const recurringBase = await resolveTaskEvents(recurringTasks);
  const recurringEvents: AgendaEvent[] = recurringBase.flatMap((base) =>
    occurrencesBetween(base.recurrence, base.dueAt!, filters.from, filters.to).map((when) => ({
      ...base,
      id: `${base.id}@${when.toISOString()}`,
      when,
      done: false,
      virtual: true,
    }))
  );

  const installationEvents: AgendaEvent[] = installations
    .filter((installation) => installation.scheduledAt)
    .map((installation) => ({
      id: `installation:${installation.id}`,
      category: "instalacao" as const,
      title: "Instalação agendada",
      subtitle: getCustomerDisplayName(installation.customer),
      when: installation.scheduledAt!,
      responsibleName: installation.responsible?.name ?? null,
      responsibleId: installation.responsible?.id ?? null,
      href: `/instalacoes/${installation.id}`,
      done: installation.status === "CONCLUIDA",
      source: "installation" as const,
    }));

  const leadEvents: AgendaEvent[] = leads
    .filter((lead) => lead.nextActionAt)
    .map((lead) => ({
      id: `lead:${lead.id}`,
      category: "crm" as const,
      title: lead.nextActionNote || "Próxima ação do lead",
      subtitle: lead.name,
      when: lead.nextActionAt!,
      responsibleName: lead.responsible?.name ?? null,
      responsibleId: lead.responsible?.id ?? null,
      href: `/crm/leads/${lead.id}`,
      done: false,
      source: "lead" as const,
    }));

  return [...taskEvents, ...recurringEvents, ...installationEvents, ...leadEvents].sort(
    (a, b) => a.when.getTime() - b.when.getTime()
  );
}

// Seção "Pendentes" da Agenda (pedido: "os atendimentos não concluídos dele
// sejam listados em algum lugar até serem concluídos") — a lista principal
// só busca tarefas com dueAt dentro do período selecionado (de hoje pra
// frente), então uma tarefa atrasada de antes de hoje, ou sem prazo nenhum
// (dueAt null nunca passa no filtro `gte/lte` da query principal), some do
// radar. Esta busca é independente do período: pega toda Task não concluída
// que esteja atrasada (antes de hoje) ou sem prazo — enquanto não for
// concluída, continua aparecendo aqui.
export async function getPendingTaskEvents(
  categories: AgendaCategory[],
  currentUser: { id: string; role: UserRole },
  responsibleId: string | null = null
): Promise<AgendaEvent[]> {
  const person = canViewAllTasks(currentUser.role) ? responsibleId : null;
  const wantsAtendimento = categories.includes("atendimento") && canAccessModule(currentUser.role, "atendimento");
  const wantsCrm = categories.includes("crm") && canAccessModule(currentUser.role, "crm");
  const wantsInstalacao = categories.includes("instalacao") && canAccessModule(currentUser.role, "instalacoes");
  const wantsGeral = categories.includes("geral");

  const taskEntityTypes = [
    ...(wantsAtendimento ? ["Conversation"] : []),
    ...(wantsCrm ? ["Opportunity", "Lead"] : []),
    ...(wantsInstalacao ? ["Installation"] : []),
    ...(wantsGeral ? ["General"] : []),
  ];
  if (taskEntityTypes.length === 0) return [];

  const taskWhere = canViewAllTasks(currentUser.role)
    ? {}
    : { OR: [{ assigneeId: currentUser.id }, { assigneeId: null }] };

  const todayStart = startOfDay(new Date());

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        taskWhere,
        person ? { assigneeId: person } : {},
        { entityType: { in: taskEntityTypes } },
        { status: { not: "CONCLUIDA" } },
        { OR: [{ dueAt: null }, { dueAt: { lt: todayStart } }] },
      ],
    },
    include: { assignee: { select: { id: true, name: true } } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  return resolveTaskEvents(tasks);
}

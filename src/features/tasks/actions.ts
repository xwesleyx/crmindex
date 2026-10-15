"use server";

import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { createNotification } from "@/lib/notifications";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { canEditConversation, getAtendimentoViewer } from "@/features/atendimento/permissions";
import { canEditInstallation } from "@/features/installations/permissions";
import { canEditLead } from "@/features/leads/permissions";
import { canEditOpportunity } from "@/features/opportunities/permissions";
import { nextOccurrence } from "@/features/tasks/recurrence";
import { taskFormSchema, type TaskFormInput } from "@/features/tasks/schema";
import { TASK_INCLUDE, type TaskItem } from "@/features/tasks/types";

// `warning`: aviso que não impede a ação (ex.: conflito de horário);
// `info`: só informativo (ex.: próxima ocorrência criada).
type ActionResult = { success: true; warning?: string; info?: string } | { success: false; error: string };

// Duração usada pra checar conflito quando a tarefa não tem duração própria.
const DEFAULT_CONFLICT_MINUTES = 30;

// Aviso de conflito (não bloqueia): o responsável já tem outra tarefa
// pendente que se sobrepõe a este horário.
async function findScheduleConflict(params: {
  assigneeId: string | null;
  dueAt: Date | null;
  durationMinutes: number | null;
  excludeTaskId?: string;
}): Promise<string | undefined> {
  const { assigneeId, dueAt, durationMinutes, excludeTaskId } = params;
  if (!assigneeId || !dueAt) return undefined;

  const start = dueAt.getTime();
  const end = start + (durationMinutes ?? DEFAULT_CONFLICT_MINUTES) * 60_000;
  const candidates = await prisma.task.findMany({
    where: {
      assigneeId,
      status: { not: "CONCLUIDA" },
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      dueAt: { gte: new Date(start - 24 * 60 * 60_000), lt: new Date(end) },
    },
    select: { title: true, dueAt: true, durationMinutes: true, assignee: { select: { name: true } } },
    orderBy: { dueAt: "asc" },
  });

  const clash = candidates.find((task) => {
    const otherStart = task.dueAt!.getTime();
    const otherEnd = otherStart + (task.durationMinutes ?? DEFAULT_CONFLICT_MINUTES) * 60_000;
    return otherStart < end && otherEnd > start;
  });
  if (!clash) return undefined;
  return `${clash.assignee?.name ?? "O responsável"} já tem "${clash.title}" em ${formatDateTime(clash.dueAt)} nesse horário.`;
}


// Task é genérico (entityType/entityId); Opportunity, Installation e Lead
// usam tarefas. A checagem de permissão delega para a entidade dona —
// quando Ticket/etc. adotarem Task, este switch cresce, não a arquitetura.
async function canManageEntityTasks(
  entityType: string,
  entityId: string,
  role: UserRole,
  userId: string
): Promise<boolean> {
  if (entityType === "Opportunity") {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: entityId },
      select: { ownerId: true },
    });
    if (!opportunity) return false;
    return canEditOpportunity(role, userId, opportunity);
  }
  if (entityType === "Installation") {
    const installation = await prisma.installation.findUnique({
      where: { id: entityId },
      select: { responsibleId: true },
    });
    if (!installation) return false;
    return canEditInstallation(role, userId, installation);
  }
  if (entityType === "Lead") {
    const lead = await prisma.lead.findUnique({
      where: { id: entityId },
      select: { responsibleId: true },
    });
    if (!lead) return false;
    return canEditLead(role, userId, lead);
  }
  if (entityType === "Conversation") {
    const conversation = await prisma.conversation.findUnique({
      where: { id: entityId },
      select: { assigneeId: true, participants: { select: { userId: true } } },
    });
    if (!conversation) return false;
    return canEditConversation(await getAtendimentoViewer({ id: userId, role }), conversation);
  }
  if (entityType === "General") {
    // Tarefa avulsa da Agenda (seção "a tarefa não precisa estar vinculada a
    // um atendimento") — não tem entidade dona de verdade, então entityId é
    // o id de quem criou; só o criador ou ADMIN/GERENTE administram.
    return entityId === userId || role === "ADMIN" || role === "GERENTE";
  }
  return false;
}

// Cada tipo de entidade dona vive num módulo diferente (Opportunity → "crm",
// Installation → "instalacoes", com perfis de acesso distintos) — sem isso,
// um Instalador (sem acesso a "crm") passaria pela checagem de posse por
// coincidência caso um dia existisse uma Task de Opportunity sem dono.
function moduleForEntityType(entityType: string) {
  if (entityType === "Opportunity") return "crm" as const;
  if (entityType === "Installation") return "instalacoes" as const;
  if (entityType === "Lead") return "crm" as const;
  if (entityType === "Conversation") return "atendimento" as const;
  if (entityType === "General") return "agenda" as const;
  return null;
}

function revalidateEntityPaths(entityType: string, entityId: string) {
  if (entityType === "Opportunity") {
    revalidatePath(`/crm/oportunidades/${entityId}`);
    revalidatePath("/crm/kanban");
  }
  if (entityType === "Installation") {
    revalidatePath(`/instalacoes/${entityId}`);
    revalidatePath("/instalacoes/kanban");
  }
  if (entityType === "Lead") {
    revalidatePath(`/crm/leads/${entityId}`);
    revalidatePath("/crm/leads");
  }
  if (entityType === "Conversation") {
    revalidatePath(`/atendimento/${entityId}`);
  }
  revalidatePath("/agenda");
}

// "toda vez que agendar alguma tarefa para o usuário ele receba a
// notificação" — dispara em duas situações: tarefa nova com responsável, ou
// tarefa existente que ganhou/trocou de responsável ou de prazo (reagendada).
// Nunca notifica quem fez a própria ação (sem ruído de "você se atribuiu
// isso").
async function notifyTaskAssignee(
  task: { id: string; title: string; dueAt: Date | null; assigneeId: string | null },
  actorUserId: string,
  reason: "created" | "rescheduled"
) {
  if (!task.assigneeId || task.assigneeId === actorUserId) return;

  await createNotification({
    userId: task.assigneeId,
    title: reason === "created" ? "Nova tarefa agendada" : "Tarefa reagendada",
    message: task.dueAt ? `${task.title} — ${formatDateTime(task.dueAt)}` : task.title,
    link: "/agenda",
  });
}

// Um lembrete só faz sentido com prazo — sem dueAt não tem "faltando X
// minutos" pra calcular, então nesse caso nenhuma linha é criada (e as que
// existiam, se o prazo foi removido numa edição, são apagadas). Reaproveita
// as linhas SENT como estão (histórico de que aquele alerta já disparou);
// só mexe nas ainda não enviadas.
async function syncTaskReminders(taskId: string, dueAt: Date | null, minutesBeforeList: number[]) {
  await prisma.taskReminder.deleteMany({ where: { taskId, sentAt: null } });
  if (!dueAt || minutesBeforeList.length === 0) return;

  const unique = [...new Set(minutesBeforeList)];
  await prisma.taskReminder.createMany({
    data: unique.map((minutesBefore) => ({ taskId, minutesBefore })),
  });
}

export async function createTask(
  entityType: string,
  entityId: string,
  input: TaskFormInput
): Promise<ActionResult> {
  const session = await auth();
  const requiredModule = moduleForEntityType(entityType);
  if (!session?.user || !requiredModule || !canAccessModule(session.user.role, requiredModule)) {
    return { success: false, error: "Você não tem permissão para criar tarefas." };
  }

  if (!(await canManageEntityTasks(entityType, entityId, session.user.role, session.user.id))) {
    return { success: false, error: "Você não tem permissão para este registro." };
  }

  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueAt: parsed.data.dueAt ?? null,
      durationMinutes: parsed.data.durationMinutes ?? null,
      // Repetição só faz sentido com prazo.
      recurrence: parsed.data.dueAt ? (parsed.data.recurrence ?? null) : null,
      priority: parsed.data.priority,
      assigneeId: parsed.data.assigneeId ?? null,
      entityType,
      entityId,
    },
  });
  const conflict = await findScheduleConflict({
    assigneeId: task.assigneeId,
    dueAt: task.dueAt,
    durationMinutes: task.durationMinutes,
    excludeTaskId: task.id,
  });

  await syncTaskReminders(task.id, task.dueAt, parsed.data.reminderMinutesBefore);
  await notifyTaskAssignee(task, session.user.id, "created");

  await logActivity({
    userId: session.user.id,
    action: "task.created",
    entityType,
    entityId,
    metadata: { taskId: task.id, title: task.title },
  });

  revalidateEntityPaths(entityType, entityId);
  return { success: true, warning: conflict };
}

export async function updateTask(id: string, input: TaskFormInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Você não tem permissão para editar tarefas." };
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Tarefa não encontrada." };

  const requiredModule = moduleForEntityType(existing.entityType);
  if (!requiredModule || !canAccessModule(session.user.role, requiredModule)) {
    return { success: false, error: "Você não tem permissão para editar tarefas." };
  }

  if (
    !(await canManageEntityTasks(existing.entityType, existing.entityId, session.user.role, session.user.id))
  ) {
    return { success: false, error: "Você não tem permissão para esta tarefa." };
  }

  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueAt: parsed.data.dueAt ?? null,
      durationMinutes: parsed.data.durationMinutes ?? null,
      recurrence: parsed.data.dueAt ? (parsed.data.recurrence ?? null) : null,
      priority: parsed.data.priority,
      assigneeId: parsed.data.assigneeId ?? null,
    },
  });

  await syncTaskReminders(updated.id, updated.dueAt, parsed.data.reminderMinutesBefore);

  const assigneeChanged = existing.assigneeId !== updated.assigneeId;
  const dueAtChanged = existing.dueAt?.getTime() !== updated.dueAt?.getTime();
  if (assigneeChanged || dueAtChanged) {
    await notifyTaskAssignee(updated, session.user.id, "rescheduled");
  }

  const conflict =
    assigneeChanged || dueAtChanged || existing.durationMinutes !== updated.durationMinutes
      ? await findScheduleConflict({
          assigneeId: updated.assigneeId,
          dueAt: updated.dueAt,
          durationMinutes: updated.durationMinutes,
          excludeTaskId: updated.id,
        })
      : undefined;

  revalidateEntityPaths(existing.entityType, existing.entityId);
  return { success: true, warning: conflict };
}

export async function toggleTaskStatus(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Tarefa não encontrada." };

  const requiredModule = moduleForEntityType(existing.entityType);
  if (!requiredModule || !canAccessModule(session.user.role, requiredModule)) {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  if (
    !(await canManageEntityTasks(existing.entityType, existing.entityId, session.user.role, session.user.id))
  ) {
    return { success: false, error: "Você não tem permissão para esta tarefa." };
  }

  const isCompleting = existing.status !== "CONCLUIDA";

  await prisma.task.update({
    where: { id },
    data: {
      status: isCompleting ? "CONCLUIDA" : "PENDENTE",
      completedAt: isCompleting ? new Date() : null,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: isCompleting ? "task.completed" : "task.reopened",
    entityType: existing.entityType,
    entityId: existing.entityId,
    metadata: { taskId: id, title: existing.title },
  });

  // Tarefa recorrente: concluir cria a próxima ocorrência (com os mesmos
  // dados e lembretes). Reabrir não desfaz a próxima já criada.
  let info: string | undefined;
  if (isCompleting && existing.recurrence && existing.dueAt) {
    const nextDueAt = nextOccurrence(existing.recurrence, existing.dueAt);
    if (nextDueAt) {
      const reminders = await prisma.taskReminder.findMany({
        where: { taskId: id },
        select: { minutesBefore: true },
      });
      const next = await prisma.task.create({
        data: {
          title: existing.title,
          description: existing.description,
          dueAt: nextDueAt,
          durationMinutes: existing.durationMinutes,
          recurrence: existing.recurrence,
          priority: existing.priority,
          assigneeId: existing.assigneeId,
          entityType: existing.entityType,
          entityId: existing.entityId,
        },
      });
      await syncTaskReminders(next.id, next.dueAt, reminders.map((r) => r.minutesBefore));
      await logActivity({
        userId: session.user.id,
        action: "task.created",
        entityType: existing.entityType,
        entityId: existing.entityId,
        metadata: { taskId: next.id, title: next.title, recurrenceOf: id },
      });
      info = `Próxima ocorrência criada para ${formatDateTime(nextDueAt)}.`;
    }
  }

  revalidateEntityPaths(existing.entityType, existing.entityId);
  return { success: true, info };
}

// Reagendar arrastando na Agenda (Grade, Semana, Calendário): troca só o
// horário. Lembretes ainda não enviados são recalculados pro novo prazo, o
// responsável é avisado e o conflito de horário vem como aviso.
export async function rescheduleTask(id: string, dueAtIso: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Você não tem permissão para esta ação." };

  const dueAt = new Date(dueAtIso);
  if (Number.isNaN(dueAt.getTime())) return { success: false, error: "Data inválida." };

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Tarefa não encontrada." };

  const requiredModule = moduleForEntityType(existing.entityType);
  if (!requiredModule || !canAccessModule(session.user.role, requiredModule)) {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }
  if (
    !(await canManageEntityTasks(existing.entityType, existing.entityId, session.user.role, session.user.id))
  ) {
    return { success: false, error: "Você não tem permissão para esta tarefa." };
  }
  if (existing.dueAt?.getTime() === dueAt.getTime()) return { success: true };

  const updated = await prisma.task.update({ where: { id }, data: { dueAt } });

  const pendingReminders = await prisma.taskReminder.findMany({
    where: { taskId: id, sentAt: null },
    select: { minutesBefore: true },
  });
  await syncTaskReminders(id, dueAt, pendingReminders.map((r) => r.minutesBefore));
  await notifyTaskAssignee(updated, session.user.id, "rescheduled");
  await logActivity({
    userId: session.user.id,
    action: "task.rescheduled",
    entityType: existing.entityType,
    entityId: existing.entityId,
    metadata: { taskId: id, title: existing.title, from: existing.dueAt, to: dueAt },
  });

  const conflict = await findScheduleConflict({
    assigneeId: updated.assigneeId,
    dueAt,
    durationMinutes: updated.durationMinutes,
    excludeTaskId: id,
  });

  revalidateEntityPaths(existing.entityType, existing.entityId);
  return { success: true, warning: conflict };
}

// Usado pela Agenda (seção "não consigo abrir uma tarefa Geral pra
// finalizar") — uma tarefa "Geral" não tem tela própria pra abrir a partir
// do link do evento, então o pop-up busca a tarefa completa (com responsável
// e lembretes) sob demanda, no clique, em vez de a Agenda já carregar tudo
// isso pra cada tarefa do período só por precaução.
export async function fetchTask(id: string): Promise<TaskItem | null> {
  const session = await auth();
  if (!session?.user) return null;

  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  if (!task) return null;

  const requiredModule = moduleForEntityType(task.entityType);
  if (!requiredModule || !canAccessModule(session.user.role, requiredModule)) return null;
  if (!(await canManageEntityTasks(task.entityType, task.entityId, session.user.role, session.user.id))) {
    return null;
  }

  return task;
}

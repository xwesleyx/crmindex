import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { createNotification } from "@/lib/notifications";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { getAgendaWhatsappRemindersEnabled } from "@/features/atendimento-automation/settings";
import { sendInternalWhatsAppMessage, type SendResult } from "@/lib/reminders/send-internal-whatsapp";

async function resolveTaskContext(entityType: string, entityId: string): Promise<string | null> {
  if (entityType === "Conversation") {
    const conversation = await prisma.conversation.findUnique({
      where: { id: entityId },
      include: { contact: { include: { company: true } } },
    });
    if (!conversation) return null;
    const companyName = conversation.contact.company
      ? ` (${conversation.contact.company.tradeName || conversation.contact.company.legalName})`
      : "";
    return `Atendimento — ${conversation.contact.name}${companyName}`;
  }
  if (entityType === "Opportunity") {
    const opportunity = await prisma.opportunity.findUnique({ where: { id: entityId }, select: { title: true } });
    return opportunity ? `Oportunidade — ${opportunity.title}` : null;
  }
  if (entityType === "Lead") {
    const lead = await prisma.lead.findUnique({ where: { id: entityId }, select: { name: true } });
    return lead ? `Lead — ${lead.name}` : null;
  }
  if (entityType === "Installation") {
    const installation = await prisma.installation.findUnique({
      where: { id: entityId },
      include: { customer: { include: { company: true, contact: true } } },
    });
    return installation ? `Instalação — ${getCustomerDisplayName(installation.customer)}` : null;
  }
  return null;
}

export function buildReminderMessage(
  task: { title: string; description: string | null; dueAt: Date },
  context: string | null
): string {
  return [
    `🔔 Lembrete: ${task.title}`,
    `Prazo: ${formatDateTime(task.dueAt)}`,
    task.description ? `\n${task.description}` : null,
    context ? `\nVinculado a: ${context}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export type ReminderOutcome =
  | { reminderId: string; outcome: "sent" }
  | { reminderId: string; outcome: "skipped_no_phone" }
  | { reminderId: string; outcome: "skipped_whatsapp_disabled" }
  | { reminderId: string; outcome: "skipped_done" }
  | { reminderId: string; outcome: "skipped_already_claimed" }
  | { reminderId: string; outcome: "failed"; error?: string };

// Varre TaskReminder ainda não enviados cujo horário de disparo (prazo da
// tarefa - minutos de antecedência) já chegou, e manda a mensagem pro
// WhatsApp do responsável. `sendFn` é injetável só pra teste (devtest deste
// projeto nunca manda mensagem de verdade pro WhatsApp — ver histórico de
// decisões desta sessão); em produção sempre usa sendInternalWhatsAppMessage.
export async function checkAndSendDueReminders(
  now: Date = new Date(),
  sendFn: (phone: string, text: string) => Promise<SendResult> = sendInternalWhatsAppMessage
): Promise<ReminderOutcome[]> {
  // Janela ampla (35 dias) pra evitar comparar um campo calculado
  // (dueAt - minutesBefore) direto no SQL — SQLite/Prisma não faz isso de
  // forma simples. O filtro fino roda em memória logo abaixo; volume de
  // tarefas com prazo é sempre pequeno, não é um problema de performance.
  const windowEnd = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);
  const candidates = await prisma.taskReminder.findMany({
    where: { sentAt: null, task: { dueAt: { not: null, lte: windowEnd } } },
    include: { task: { include: { assignee: true } } },
  });

  const outcomes: ReminderOutcome[] = [];
  // Configurações > Mensagens automáticas > Lembretes da Agenda. Desligado,
  // o lembrete continua sendo "consumido" (sentAt) e notificado no sino —
  // só não sai pelo WhatsApp. Assim, religar não dispara de uma vez todos
  // os lembretes que venceram enquanto estava desligado.
  const whatsappEnabled = await getAgendaWhatsappRemindersEnabled();

  for (const reminder of candidates) {
    const task = reminder.task;
    const dueAt = task.dueAt;
    if (!dueAt || task.status === "CONCLUIDA") {
      outcomes.push({ reminderId: reminder.id, outcome: "skipped_done" });
      continue;
    }

    const fireAt = dueAt.getTime() - reminder.minutesBefore * 60 * 1000;
    if (fireAt > now.getTime()) continue; // ainda não chegou a hora — nem entra no outcomes

    // Claim atômico: se dois ciclos se sobrepuserem (tick lento), só um
    // consegue marcar sentAt e de fato enviar.
    const claimed = await prisma.taskReminder.updateMany({
      where: { id: reminder.id, sentAt: null },
      data: { sentAt: now },
    });
    if (claimed.count === 0) {
      outcomes.push({ reminderId: reminder.id, outcome: "skipped_already_claimed" });
      continue;
    }

    const context = await resolveTaskContext(task.entityType, task.entityId);
    const message = buildReminderMessage({ title: task.title, description: task.description, dueAt }, context);

    if (task.assigneeId) {
      await createNotification({
        userId: task.assigneeId,
        title: "Lembrete de tarefa",
        message: `${task.title} — Prazo: ${formatDateTime(dueAt)}`,
        link: "/agenda",
      });
    }

    if (!whatsappEnabled) {
      outcomes.push({ reminderId: reminder.id, outcome: "skipped_whatsapp_disabled" });
      continue;
    }

    if (!task.assignee?.phone) {
      outcomes.push({ reminderId: reminder.id, outcome: "skipped_no_phone" });
      continue;
    }

    const result = await sendFn(task.assignee.phone, message);

    outcomes.push(
      result.ok
        ? { reminderId: reminder.id, outcome: "sent" }
        : { reminderId: reminder.id, outcome: "failed", error: result.error }
    );
  }

  return outcomes;
}

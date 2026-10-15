import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { getCustomerDisplayName } from "@/features/customers/utils";
import {
  getAgendaDailySummaryWhatsappEnabled,
  getAgendaWhatsappRemindersEnabled,
} from "@/features/atendimento-automation/settings";
import { sendInternalWhatsAppMessage, type SendResult } from "@/lib/reminders/send-internal-whatsapp";
import { occurrencesBetween } from "@/features/tasks/recurrence";

// Resumo do dia da Agenda: às 07:00 de Brasília, cada pessoa com
// compromissos no dia recebe uma notificação no sino com a lista (e, se
// ligado em Configurações > Mensagens automáticas, também no WhatsApp).
// Roda no mesmo ciclo de 1 min dos lembretes (instrumentation.ts); a data
// do último envio fica salva, então dispara uma vez por dia mesmo com o
// servidor reiniciando. Horário fixo em Brasília (UTC-3, sem horário de
// verão) pra funcionar igual no servidor local e no Render (que roda em UTC).
const SUMMARY_HOUR = 7;
const BRASILIA_OFFSET_MS = -3 * 60 * 60_000;
const LAST_RUN_KEY = "agenda.dailySummary.lastRunDate";
const MAX_ITEMS_IN_MESSAGE = 10;

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

type SummaryItem = { at: Date; text: string };

async function itemsForUser(userId: string, from: Date, to: Date): Promise<SummaryItem[]> {
  const [tasks, recurring, installations, leads] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: "CONCLUIDA" }, dueAt: { gte: from, lt: to } },
      select: { title: true, dueAt: true },
    }),
    // Tarefas que repetem: a ocorrência de hoje conta também.
    prisma.task.findMany({
      where: { assigneeId: userId, status: { not: "CONCLUIDA" }, recurrence: { not: null }, dueAt: { lt: from } },
      select: { title: true, dueAt: true, recurrence: true },
    }),
    prisma.installation.findMany({
      where: { responsibleId: userId, status: "EM_ANDAMENTO", scheduledAt: { gte: from, lt: to } },
      select: { scheduledAt: true, customer: { include: { company: true, contact: true } } },
    }),
    prisma.lead.findMany({
      where: { responsibleId: userId, deletedAt: null, nextActionAt: { gte: from, lt: to } },
      select: { name: true, nextActionAt: true, nextActionNote: true },
    }),
  ]);

  return [
    ...tasks.map((task) => ({ at: task.dueAt!, text: task.title })),
    ...recurring.flatMap((task) =>
      occurrencesBetween(task.recurrence, task.dueAt!, from, new Date(to.getTime() - 1)).map((at) => ({
        at,
        text: task.title,
      }))
    ),
    ...installations.map((installation) => ({
      at: installation.scheduledAt!,
      text: `Instalação — ${getCustomerDisplayName(installation.customer)}`,
    })),
    ...leads.map((lead) => ({
      at: lead.nextActionAt!,
      text: `${lead.nextActionNote || "Próxima ação"} — ${lead.name}`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export async function sendDailyAgendaSummaries(
  now: Date = new Date(),
  sendFn: (phone: string, text: string) => Promise<SendResult> = sendInternalWhatsAppMessage
): Promise<{ ran: boolean; notified: number; whatsapp: number }> {
  const brasiliaNow = new Date(now.getTime() + BRASILIA_OFFSET_MS);
  if (brasiliaNow.getUTCHours() < SUMMARY_HOUR) return { ran: false, notified: 0, whatsapp: 0 };

  const today = brasiliaNow.toISOString().slice(0, 10);
  if ((await getAppSetting(LAST_RUN_KEY)) === today) return { ran: false, notified: 0, whatsapp: 0 };
  // Marca antes de enviar: se algo falhar no meio, não repete a cada minuto.
  await setAppSetting(LAST_RUN_KEY, today);

  const dayStart = new Date(`${today}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const [users, whatsappSummary, whatsappReminders] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true, phone: true },
    }),
    getAgendaDailySummaryWhatsappEnabled(),
    getAgendaWhatsappRemindersEnabled(),
  ]);

  let notified = 0;
  let whatsapp = 0;
  for (const user of users) {
    const items = await itemsForUser(user.id, dayStart, dayEnd);
    if (items.length === 0) continue;

    const lines = items.slice(0, MAX_ITEMS_IN_MESSAGE).map((item) => `${timeFormatter.format(item.at)} — ${item.text}`);
    const more = items.length > MAX_ITEMS_IN_MESSAGE ? `\n+${items.length - MAX_ITEMS_IN_MESSAGE} outros` : "";
    const count = `${items.length} compromisso${items.length === 1 ? "" : "s"}`;

    await createNotification({
      userId: user.id,
      title: `Sua agenda de hoje: ${count}`,
      message: lines.join(" · ") + (more ? ` · ${more.trim()}` : ""),
      link: "/agenda",
    });
    notified++;

    if (whatsappSummary && whatsappReminders && user.phone) {
      const firstName = user.name.split(" ")[0];
      const text = `☀️ Bom dia, ${firstName}! Você tem ${count} hoje:\n\n${lines.join("\n")}${more}`;
      const result = await sendFn(user.phone, text).catch(() => ({ ok: false }));
      if (result.ok) whatsapp++;
    }
  }

  return { ran: true, notified, whatsapp };
}

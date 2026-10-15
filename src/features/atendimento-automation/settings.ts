import { getAppSetting, setAppSetting } from "@/lib/app-settings";

// Guardado em AppSetting (chave-valor já existente, ver comentário no
// schema — "serve pra qualquer config futura sem precisar de migration
// nova") em vez de um modelo próprio: são só 3 mensagens de texto + 2 flags
// + 1 horário, sem histórico/versionamento necessário.
export const ATENDIMENTO_AUTOMATION_KEYS = {
  welcomeEnabled: "atendimento.welcomeMessage.enabled",
  welcomeText: "atendimento.welcomeMessage.text",
  closingEnabled: "atendimento.closingMessage.enabled",
  closingText: "atendimento.closingMessage.text",
  afterHoursEnabled: "atendimento.afterHours.enabled",
  afterHoursTime: "atendimento.afterHours.time",
  afterHoursText: "atendimento.afterHours.text",
} as const;

export type AtendimentoAutomationSettings = {
  welcomeMessage: { enabled: boolean; text: string };
  closingMessage: { enabled: boolean; text: string };
  afterHours: { enabled: boolean; time: string; text: string };
};

const DEFAULT_AFTER_HOURS_TIME = "18:30";

// Lido tanto pela tela de Configurações (mostrar o estado atual) quanto
// pelos gatilhos reais em features/atendimento/actions.ts (decidir se manda
// a mensagem automática) — um só lugar resolve as 7 chaves de uma vez.
export async function getAtendimentoAutomationSettings(): Promise<AtendimentoAutomationSettings> {
  const K = ATENDIMENTO_AUTOMATION_KEYS;
  const [welcomeEnabled, welcomeText, closingEnabled, closingText, afterHoursEnabled, afterHoursTime, afterHoursText] =
    await Promise.all([
      getAppSetting(K.welcomeEnabled),
      getAppSetting(K.welcomeText),
      getAppSetting(K.closingEnabled),
      getAppSetting(K.closingText),
      getAppSetting(K.afterHoursEnabled),
      getAppSetting(K.afterHoursTime),
      getAppSetting(K.afterHoursText),
    ]);

  return {
    welcomeMessage: { enabled: welcomeEnabled === "true", text: welcomeText ?? "" },
    closingMessage: { enabled: closingEnabled === "true", text: closingText ?? "" },
    afterHours: {
      enabled: afterHoursEnabled === "true",
      time: afterHoursTime ?? DEFAULT_AFTER_HOURS_TIME,
      text: afterHoursText ?? "",
    },
  };
}

export async function saveWelcomeMessageSettings(enabled: boolean, text: string, userId: string): Promise<void> {
  const K = ATENDIMENTO_AUTOMATION_KEYS;
  await Promise.all([
    setAppSetting(K.welcomeEnabled, String(enabled), userId),
    setAppSetting(K.welcomeText, text, userId),
  ]);
}

export async function saveClosingMessageSettings(enabled: boolean, text: string, userId: string): Promise<void> {
  const K = ATENDIMENTO_AUTOMATION_KEYS;
  await Promise.all([
    setAppSetting(K.closingEnabled, String(enabled), userId),
    setAppSetting(K.closingText, text, userId),
  ]);
}

export async function saveAfterHoursSettings(
  enabled: boolean,
  time: string,
  text: string,
  userId: string
): Promise<void> {
  const K = ATENDIMENTO_AUTOMATION_KEYS;
  await Promise.all([
    setAppSetting(K.afterHoursEnabled, String(enabled), userId),
    setAppSetting(K.afterHoursTime, time, userId),
    setAppSetting(K.afterHoursText, text, userId),
  ]);
}

// "depois das 18h30" — compara só hora:minuto do horário local do servidor
// contra o horário configurado (sem suporte a intervalo/dias da semana,
// pedido do usuário foi só "depois de tal horário").
export function isPastAfterHoursCutoff(time: string, now: Date = new Date()): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return false;
  const cutoffMinutes = Number(match[1]) * 60 + Number(match[2]);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= cutoffMinutes;
}

// Só manda a mensagem de fora-do-horário 1x por dia por conversa (senão
// cada mensagem nova do cliente durante a noite dispararia de novo) —
// compara a data (ano/mês/dia), não o timestamp exato.
export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Lembretes da Agenda por WhatsApp (TaskReminder → WhatsApp do
// responsável). Ligado por padrão — sem nada salvo, continua enviando como
// sempre enviou. Desligado, o lembrete ainda vira notificação no sino.
const AGENDA_WHATSAPP_REMINDERS_KEY = "agenda.whatsappReminders.enabled";

export async function getAgendaWhatsappRemindersEnabled(): Promise<boolean> {
  return (await getAppSetting(AGENDA_WHATSAPP_REMINDERS_KEY)) !== "false";
}

export async function saveAgendaWhatsappRemindersEnabled(enabled: boolean, userId: string): Promise<void> {
  await setAppSetting(AGENDA_WHATSAPP_REMINDERS_KEY, String(enabled), userId);
}

// Resumo do dia (07:00) também pelo WhatsApp — desligado por padrão; a
// notificação no sino sai sempre (lib/reminders/daily-agenda-summary.ts).
const AGENDA_DAILY_SUMMARY_WHATSAPP_KEY = "agenda.dailySummary.whatsapp";

export async function getAgendaDailySummaryWhatsappEnabled(): Promise<boolean> {
  return (await getAppSetting(AGENDA_DAILY_SUMMARY_WHATSAPP_KEY)) === "true";
}

export async function saveAgendaDailySummaryWhatsappEnabled(enabled: boolean, userId: string): Promise<void> {
  await setAppSetting(AGENDA_DAILY_SUMMARY_WHATSAPP_KEY, String(enabled), userId);
}

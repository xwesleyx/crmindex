"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import {
  saveAfterHoursSettings,
  saveAgendaWhatsappRemindersEnabled,
  saveClosingMessageSettings,
  saveWelcomeMessageSettings,
  saveAgendaDailySummaryWhatsappEnabled,
} from "@/features/atendimento-automation/settings";
import {
  afterHoursSettingsSchema,
  agendaRemindersSettingsSchema,
  closingMessageSettingsSchema,
  welcomeMessageSettingsSchema,
  type AfterHoursSettingsInput,
  type AgendaRemindersSettingsInput,
  type ClosingMessageSettingsInput,
  type WelcomeMessageSettingsInput,
} from "@/features/atendimento-automation/schema";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function updateWelcomeMessageSettings(input: WelcomeMessageSettingsInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const parsed = welcomeMessageSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await saveWelcomeMessageSettings(parsed.data.enabled, parsed.data.text, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "atendimento_automation.welcome_updated",
    entityType: "AppSetting",
    entityId: "atendimento.welcomeMessage",
    metadata: { enabled: parsed.data.enabled },
  });

  revalidatePath("/configuracoes/atendimento-automatico");
  return { success: true };
}

export async function updateClosingMessageSettings(input: ClosingMessageSettingsInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const parsed = closingMessageSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await saveClosingMessageSettings(parsed.data.enabled, parsed.data.text, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "atendimento_automation.closing_updated",
    entityType: "AppSetting",
    entityId: "atendimento.closingMessage",
    metadata: { enabled: parsed.data.enabled },
  });

  revalidatePath("/configuracoes/atendimento-automatico");
  return { success: true };
}

export async function updateAfterHoursSettings(input: AfterHoursSettingsInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const parsed = afterHoursSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await saveAfterHoursSettings(parsed.data.enabled, parsed.data.time, parsed.data.text, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "atendimento_automation.after_hours_updated",
    entityType: "AppSetting",
    entityId: "atendimento.afterHours",
    metadata: { enabled: parsed.data.enabled, time: parsed.data.time },
  });

  revalidatePath("/configuracoes/atendimento-automatico");
  return { success: true };
}

export async function updateAgendaRemindersSettings(input: AgendaRemindersSettingsInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para esta ação." };

  const parsed = agendaRemindersSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos." };

  await saveAgendaWhatsappRemindersEnabled(parsed.data.enabled, session.user.id);
  await saveAgendaDailySummaryWhatsappEnabled(parsed.data.dailySummaryWhatsapp, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "atendimento_automation.agenda_reminders_updated",
    entityType: "AppSetting",
    entityId: "agenda.whatsappReminders",
    metadata: { enabled: parsed.data.enabled, dailySummaryWhatsapp: parsed.data.dailySummaryWhatsapp },
  });

  revalidatePath("/configuracoes/atendimento-automatico");
  // O layout lê essa flag pra esconder o lembrete nos formulários de tarefa.
  revalidatePath("/", "layout");
  return { success: true };
}

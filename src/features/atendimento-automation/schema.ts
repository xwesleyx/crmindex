import { z } from "zod";

function requireTextWhenEnabled<T extends { enabled: boolean; text: string }>(data: T, ctx: z.RefinementCtx) {
  if (data.enabled && data.text.trim().length === 0) {
    ctx.addIssue({ code: "custom", message: "Informe a mensagem", path: ["text"] });
  }
}

export const welcomeMessageSettingsSchema = z
  .object({
    enabled: z.boolean(),
    text: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  })
  .superRefine(requireTextWhenEnabled);

export type WelcomeMessageSettingsInput = z.infer<typeof welcomeMessageSettingsSchema>;

export const closingMessageSettingsSchema = z
  .object({
    enabled: z.boolean(),
    text: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  })
  .superRefine(requireTextWhenEnabled);

export type ClosingMessageSettingsInput = z.infer<typeof closingMessageSettingsSchema>;

export const afterHoursSettingsSchema = z
  .object({
    enabled: z.boolean(),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use o formato HH:MM"),
    text: z.string().trim().max(2000, "Máximo 2000 caracteres"),
  })
  .superRefine(requireTextWhenEnabled);

export type AfterHoursSettingsInput = z.infer<typeof afterHoursSettingsSchema>;

export const agendaRemindersSettingsSchema = z.object({
  enabled: z.boolean(),
  // Resumo do dia às 07:00 também pelo WhatsApp (o do sino sai sempre).
  dailySummaryWhatsapp: z.boolean(),
});

export type AgendaRemindersSettingsInput = z.infer<typeof agendaRemindersSettingsSchema>;

import { z } from "zod";

import { MEDIA_KINDS } from "@/features/cleanup/kinds";

export const cleanupSettingsSchema = z.object({
  enabled: z.boolean(),
  months: z.number().int().min(1, "Mínimo de 1 mês.").max(120, "Máximo de 120 meses."),
  kinds: z.array(z.enum(MEDIA_KINDS)),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
  backupFirst: z.boolean(),
});

export type CleanupSettingsInput = z.infer<typeof cleanupSettingsSchema>;

export const mediaFilterSchema = z.object({
  kinds: z.array(z.enum(MEDIA_KINDS)).min(1),
  olderThanMonths: z.number().int().min(0).max(120),
  contactId: z.string().max(64).nullish(),
});

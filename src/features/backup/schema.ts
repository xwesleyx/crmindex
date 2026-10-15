import { z } from "zod";

export const backupSettingsSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido."),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  dir: z.string().trim().max(500, "Caminho muito longo."),
  keep: z.number().int().min(1, "Guarde pelo menos 1 backup.").max(365, "Máximo de 365 backups."),
  includeMedia: z.boolean(),
});

export type BackupSettingsInput = z.infer<typeof backupSettingsSchema>;

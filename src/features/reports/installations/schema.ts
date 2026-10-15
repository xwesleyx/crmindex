import { z } from "zod";

export const installationsReportFiltersSchema = z.object({
  q: z.string().trim().optional(),
  responsibleId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  status: z.enum(["all", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional().default("all"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export type InstallationsReportFilters = z.infer<typeof installationsReportFiltersSchema>;

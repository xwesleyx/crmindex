import { z } from "zod";

// Relatórios (controle de atendimentos, seção pedida pelo usuário): ao
// contrário da Central (queries.ts de atendimento, que sempre esconde
// encerradas), aqui é o lugar certo pra ver TUDO — inclusive encerradas.
export const reportsFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["all", "active", "closed"]).optional().default("all"),
  assigneeId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export type ReportsFilters = z.infer<typeof reportsFiltersSchema>;

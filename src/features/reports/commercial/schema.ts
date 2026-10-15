import { LeadOrigin } from "@prisma/client";
import { z } from "zod";

export const commercialReportFiltersSchema = z.object({
  q: z.string().trim().optional(),
  responsibleId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  status: z.enum(["all", "OPEN", "WON", "LOST"]).optional().default("all"),
  origin: z.nativeEnum(LeadOrigin).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export type CommercialReportFilters = z.infer<typeof commercialReportFiltersSchema>;

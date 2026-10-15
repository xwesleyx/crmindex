import { LeadOrigin } from "@prisma/client";
import { z } from "zod";

import { onlyDigits } from "@/lib/validators";
import { optionalCep, optionalCnpj, optionalEmail, optionalPhone, optionalText, optionalUrl } from "@/lib/zod-helpers";

export const companyFormSchema = z.object({
  legalName: z.string().trim().min(2, "Informe a razão social"),
  tradeName: optionalText,
  cnpj: optionalCnpj,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  website: optionalUrl,
  addressLine: optionalText,
  addressNumber: optionalText,
  complement: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalCep,
  notes: optionalText,
  isActive: z.boolean(),
  origin: z.nativeEnum(LeadOrigin).optional(),
  responsibleId: z.string().optional(),
  regionId: z.string().optional(),
});

export type CompanyFormInput = z.infer<typeof companyFormSchema>;

export function normalizeCnpj(cnpj: string | undefined): string | undefined {
  if (!cnpj) return undefined;
  return onlyDigits(cnpj);
}

export const companyFiltersSchema = z.object({
  q: z.string().trim().optional(),
  origin: z.nativeEnum(LeadOrigin).optional(),
  responsibleId: z.string().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["createdAt", "legalName"]).optional().default("createdAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

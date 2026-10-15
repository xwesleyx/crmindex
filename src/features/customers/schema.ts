import { CustomerStatus } from "@prisma/client";
import { z } from "zod";

import { optionalText } from "@/lib/zod-helpers";

// Cliente nasce da automação de Venda Ganha — este formulário só edita os
// campos operacionais (status, responsável, observações), não recria a
// identidade (Company/Contact continuam sendo a fonte da verdade).
export const customerFormSchema = z.object({
  status: z.nativeEnum(CustomerStatus),
  responsibleId: z.string().optional(),
  regionId: z.string().optional(),
  notes: optionalText,
});

export type CustomerFormInput = z.infer<typeof customerFormSchema>;

// Cadastro manual (Central de Atendimento precisa vincular contato a um
// cliente que ainda não existe — nem toda relação comercial nasce de uma
// oportunidade ganha). Empresa e Contato continuam sendo a fonte da
// identidade (nome/CNPJ/telefone) — aqui só escolhe QUEM vira cliente.
export const createCustomerSchema = z
  .object({
    companyId: z.string().optional(),
    contactId: z.string().optional(),
    responsibleId: z.string().optional(),
    notes: optionalText,
  })
  .refine((data) => data.companyId || data.contactId, {
    message: "Selecione uma empresa ou um contato",
    path: ["companyId"],
  });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const customerFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: z.nativeEnum(CustomerStatus).optional(),
  responsibleId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["becameCustomerAt", "createdAt"]).optional().default("becameCustomerAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type CustomerFilters = z.infer<typeof customerFiltersSchema>;

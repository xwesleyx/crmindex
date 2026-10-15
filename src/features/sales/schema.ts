import { PaymentMethod, SaleStatus } from "@prisma/client";
import { z } from "zod";

import { optionalText } from "@/lib/zod-helpers";

// Só os campos que fazem sentido editar depois que a venda já foi criada
// pela automação de Venda Ganha (seção 16 do escopo: "não alterar uma venda
// ganha de maneira destrutiva") — amountCents/status/vínculos ficam de fora,
// só desconto/forma de pagamento/recorrência/observações são ajustáveis.
export const updateSaleSchema = z.object({
  discountCents: z.number().int().min(0, "Valor não pode ser negativo").optional(),
  recurringAmountCents: z.number().int().min(0, "Valor não pode ser negativo").optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  notes: optionalText,
});

export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;

export const saleFiltersSchema = z.object({
  q: z.string().trim().optional(),
  ownerId: z.string().optional(),
  status: z.nativeEnum(SaleStatus).optional(),
  minValueCents: z.coerce.number().int().min(0).optional(),
  maxValueCents: z.coerce.number().int().min(0).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  sort: z.enum(["soldAt", "amountCents"]).optional().default("soldAt"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type SaleFilters = z.infer<typeof saleFiltersSchema>;

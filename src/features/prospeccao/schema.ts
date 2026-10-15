import { z } from "zod";

import { isValidUF } from "@/lib/br-states";

export const PROSPECCAO_DIAS_OPTIONS = [7, 15, 30, 60, 90] as const;

export const prospeccaoSearchSchema = z.object({
  uf: z.string().refine(isValidUF, "UF inválida"),
  cidade: z.string().trim().min(1, "Selecione a cidade"),
  dias: z.coerce
    .number()
    .int()
    .refine((n) => (PROSPECCAO_DIAS_OPTIONS as readonly number[]).includes(n), "Período inválido"),
  cnae: z.string().trim().optional(),
  // Parâmetro reveal=1 da CFO — desmascara telefone/e-mail, mas custa 1
  // "lead revelado" da cota mensal por empresa encontrada na busca (não é
  // por clique, é por resultado). Por isso fica desligado por padrão: ligado
  // sempre gastaria a cota inteira numa busca só de 25 resultados.
  revelarContatos: z.boolean().optional(),
});

export type ProspeccaoSearchInput = z.infer<typeof prospeccaoSearchSchema>;

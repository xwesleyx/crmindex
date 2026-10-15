import { z } from "zod";

import { isValidCEP, isValidCNPJ, isValidPhone } from "@/lib/validators";

// Builders de campo reutilizados por Leads, Contatos e Empresas — mesma
// validação de telefone/e-mail/CNPJ em todo o CRM (nunca duplicada).
export function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export const requiredPhone = z
  .string()
  .trim()
  .min(1, "Informe o telefone")
  .refine(isValidPhone, "Telefone inválido — use DDD + número");

export const optionalPhone = z.preprocess(
  emptyToUndefined,
  z.string().refine(isValidPhone, "Telefone inválido — use DDD + número").optional()
);

export const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("E-mail inválido").optional()
);

export const optionalCnpj = z.preprocess(
  emptyToUndefined,
  z.string().refine(isValidCNPJ, "CNPJ inválido").optional()
);

export const optionalCep = z.preprocess(
  emptyToUndefined,
  z.string().refine(isValidCEP, "CEP inválido — use 8 dígitos").optional()
);

export const optionalUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((v) => {
      try {
        new URL(v.startsWith("http") ? v : `https://${v}`);
        return true;
      } catch {
        return false;
      }
    }, "Site inválido")
    .optional()
);

export const optionalText = z.preprocess(emptyToUndefined, z.string().optional());

export const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

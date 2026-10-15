import { z } from "zod";

// Atalho digitado depois da "/" no campo de mensagem — só letras/números,
// sem espaço nem barra (a barra é a tecla de gatilho, não faz parte do
// valor salvo). Normalizado pra minúsculo (ver actions.ts) pra "/P" e "/p"
// nunca virarem dois atalhos diferentes.
export const quickReplyFormSchema = z.object({
  shortcut: z
    .string()
    .trim()
    .min(1, "Informe o atalho")
    .max(20, "Máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_-]+$/, "Use só letras, números, - ou _ (sem espaço nem barra)"),
  message: z.string().trim().min(1, "Informe a mensagem").max(2000, "Máximo 2000 caracteres"),
});

export type QuickReplyFormInput = z.infer<typeof quickReplyFormSchema>;

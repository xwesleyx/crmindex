import { z } from "zod";

import { isValidPhone } from "@/lib/validators";

export const USER_ROLES = [
  "ADMIN",
  "GERENTE",
  "VENDEDOR",
  "ATENDIMENTO",
  "INSTALADOR",
  "FINANCEIRO",
] as const;

// Mesmo formato do resto do CRM (DDD + número, sem "55" — validators.ts
// explica o porquê) — é pra onde o lembrete automático de tarefa manda a
// mensagem no WhatsApp, nunca visível pro cliente.
const phoneField = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isValidPhone(v), "Telefone inválido (DDD + número, sem o 55)");

// Login: e-mail OU nome de usuário simples (ex.: "admin", o usuário que a
// instalação limpa já traz). Gravado na mesma coluna User.email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export const loginIdentifierField = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (v) => EMAIL_PATTERN.test(v) || USERNAME_PATTERN.test(v),
    "Informe um e-mail ou um usuário (3+ letras/números, sem espaço)"
  );

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo"),
  email: loginIdentifierField,
  password: z.string().min(7, "A senha deve ter no mínimo 7 caracteres"),
  role: z.enum(USER_ROLES),
  phone: phoneField,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Vazio = "não trocar a senha" — só valida o mínimo de 8 quando algo foi digitado.
const optionalNewPasswordField = z
  .string()
  .optional()
  .refine((v) => !v || v.length >= 7, "A senha deve ter no mínimo 7 caracteres");

// ADMIN editando qualquer usuário em Configurações > Usuários — reseta a
// senha sem precisar saber a atual (é gestão de conta alheia).
export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo"),
  email: loginIdentifierField,
  phone: phoneField,
  newPassword: optionalNewPasswordField,
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Autoatendimento ("Meu perfil", qualquer perfil) — trocar a própria senha
// exige confirmar a atual.
export const updateOwnProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo"),
    email: loginIdentifierField,
    phone: phoneField,
    currentPassword: z.string().optional(),
    newPassword: optionalNewPasswordField,
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: "Informe a senha atual para trocar a senha",
    path: ["currentPassword"],
  });

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

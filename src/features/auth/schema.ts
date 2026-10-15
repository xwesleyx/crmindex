import { z } from "zod";

import { loginIdentifierField } from "@/features/users/schema";

export const loginSchema = z.object({
  email: loginIdentifierField,
  password: z.string().min(7, "A senha deve ter no mínimo 7 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

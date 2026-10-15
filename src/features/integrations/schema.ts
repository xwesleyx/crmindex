import { z } from "zod";

export const cfoApiKeySchema = z.object({
  apiKey: z.string().trim().min(10, "A API key parece muito curta — confira se copiou certo."),
});

export type CfoApiKeyInput = z.infer<typeof cfoApiKeySchema>;

export const whatsappProviderSchema = z.object({
  provider: z.enum(["manual", "neonize", "whatsapp_cloud"]),
});

export type WhatsappProviderInput = z.infer<typeof whatsappProviderSchema>;

// Campo em branco = manter o valor já salvo (o token e o App Secret nunca
// voltam pra tela depois de salvos).
export const whatsappCloudConfigSchema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{6,}$/.test(v), "O Phone Number ID tem só números (ex.: 1234567890123456)."),
  accessToken: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length >= 50, "O token parece muito curto — confira se copiou inteiro."),
  appSecret: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[a-f0-9]{32}$/i.test(v), "O App Secret tem 32 caracteres (letras e números)."),
});

export type WhatsappCloudConfigInput = z.infer<typeof whatsappCloudConfigSchema>;

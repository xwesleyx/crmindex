import { getAppSetting } from "@/lib/app-settings";

// Configuração da API oficial do WhatsApp (WhatsApp Cloud API, da Meta) —
// tudo salvo no banco pela tela de Configurações > Integrações (AppSetting),
// mesmo esquema da API key da CFO. Só roda no servidor: o token nunca chega
// ao browser.
export const WHATSAPP_CLOUD_KEYS = {
  accessToken: "WHATSAPP_CLOUD_ACCESS_TOKEN",
  phoneNumberId: "WHATSAPP_CLOUD_PHONE_NUMBER_ID",
  appSecret: "WHATSAPP_CLOUD_APP_SECRET",
  verifyToken: "WHATSAPP_CLOUD_VERIFY_TOKEN",
} as const;

// Versão da Graph API usada em todas as chamadas — dá pra sobrescrever pelo
// .env quando a Meta descontinuar esta (cada versão vale ~2 anos).
export const GRAPH_API_VERSION = process.env.WHATSAPP_CLOUD_API_VERSION || "v23.0";

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`;
}

export type WhatsappCloudConfig = {
  accessToken: string | null;
  phoneNumberId: string | null;
  appSecret: string | null;
  verifyToken: string | null;
};

export async function getWhatsappCloudConfig(): Promise<WhatsappCloudConfig> {
  const [accessToken, phoneNumberId, appSecret, verifyToken] = await Promise.all([
    getAppSetting(WHATSAPP_CLOUD_KEYS.accessToken, process.env.WHATSAPP_CLOUD_ACCESS_TOKEN),
    getAppSetting(WHATSAPP_CLOUD_KEYS.phoneNumberId, process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID),
    getAppSetting(WHATSAPP_CLOUD_KEYS.appSecret, process.env.WHATSAPP_CLOUD_APP_SECRET),
    getAppSetting(WHATSAPP_CLOUD_KEYS.verifyToken, process.env.WHATSAPP_CLOUD_VERIFY_TOKEN),
  ]);
  return { accessToken, phoneNumberId, appSecret, verifyToken };
}

// Lança erro (capturado pelo provider) quando falta o mínimo pra enviar.
export async function requireWhatsappCloudConfig(): Promise<{ accessToken: string; phoneNumberId: string }> {
  const config = await getWhatsappCloudConfig();
  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error("API oficial do WhatsApp não configurada (token/Phone Number ID).");
  }
  return { accessToken: config.accessToken, phoneNumberId: config.phoneNumberId };
}

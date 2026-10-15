import { getAppSetting } from "@/lib/app-settings";
import { manualProvider } from "@/features/atendimento/providers/manual-provider";
import { neonizeProvider } from "@/features/atendimento/providers/neonize-provider";
import { whatsappCloudProvider } from "@/features/atendimento/providers/whatsapp-cloud-provider";
import type { MessageProvider } from "@/features/atendimento/providers/types";

// Ponto único de escolha de provider (seção 20/21). "manual" = nenhuma API
// real conectada; "neonize" fala com whatsapp-service/ por HTTP (QR code);
// "whatsapp_cloud" é a API oficial da Meta. Um provider novo só precisa se
// registrar aqui, sem tocar em actions.ts nem na UI da Central.
const PROVIDERS: Record<string, MessageProvider> = {
  manual: manualProvider,
  neonize: neonizeProvider,
  whatsapp_cloud: whatsappCloudProvider,
};

export const WHATSAPP_PROVIDER_SETTING = "WHATSAPP_PROVIDER";

export type WhatsappProviderName = "manual" | "neonize" | "whatsapp_cloud";

export function isWhatsappProviderName(value: string): value is WhatsappProviderName {
  return value in PROVIDERS;
}

export function getMessageProvider(providerName: string = "manual"): MessageProvider {
  return PROVIDERS[providerName] ?? manualProvider;
}

// Provider usado ao CRIAR uma conversa nova (seja por mensagem recebida de
// verdade, seja iniciada pelo Kanban/Central). Escolhido em Configurações >
// Integrações (salvo no banco); sem escolha salva, cai no WHATSAPP_PROVIDER
// do .env, e sem nada disso continua "manual". Conversas já existentes
// mantêm o provider com que foram criadas (Conversation.provider).
export async function getDefaultProviderName(): Promise<WhatsappProviderName> {
  const configured = await getAppSetting(WHATSAPP_PROVIDER_SETTING, process.env.WHATSAPP_PROVIDER);
  return configured && isWhatsappProviderName(configured) ? configured : "manual";
}

import { getAppSetting } from "@/lib/app-settings";

// Status da integração de Prospecção CNPJ (CFO.com.br) pra tela de
// Integrações — só checa se a key está presente, sem gastar uma busca da
// cota gratuita só pra "testar conexão" (mesmo cuidado do WhatsApp, mas sem
// endpoint de "ping" — a CFO não expõe um).
export type CfoStatus = { configured: boolean };

export async function getCfoStatus(): Promise<CfoStatus> {
  const apiKey = await getAppSetting("CFO_API_KEY", process.env.CFO_API_KEY);
  return { configured: !!apiKey };
}

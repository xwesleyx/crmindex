"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { deleteAppSetting, setAppSetting } from "@/lib/app-settings";
import { WHATSAPP_PROVIDER_SETTING } from "@/features/atendimento/providers/registry";
import { WHATSAPP_CLOUD_KEYS } from "@/features/integrations/whatsapp-cloud-config";
import {
  isServiceHealthy,
  startLocalService,
  waitUntilSettled,
  waitUntilStopped,
} from "@/features/integrations/whatsapp-process";
import {
  cfoApiKeySchema,
  whatsappCloudConfigSchema,
  whatsappProviderSchema,
  type CfoApiKeyInput,
  type WhatsappCloudConfigInput,
  type WhatsappProviderInput,
} from "@/features/integrations/schema";

type ActionResult = { success: true } | { success: false; error: string };

async function callWhatsappService(path: string): Promise<ActionResult> {
  const base = process.env.WHATSAPP_SERVICE_URL;
  const secret = process.env.WHATSAPP_SERVICE_SECRET;

  if (!base || !secret) {
    return { success: false, error: "WHATSAPP_SERVICE_URL/WHATSAPP_SERVICE_SECRET não configurados." };
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      return { success: false, error: body?.detail ?? "Erro ao executar ação no WhatsApp." };
    }
    return { success: true };
  } catch {
    return {
      success: false,
      error: "O serviço do WhatsApp não está respondendo (parado ou caiu). Atualize a página e use Iniciar serviço.",
    };
  }
}

export async function updateCfoApiKey(input: CfoApiKeyInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = cfoApiKeySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await setAppSetting("CFO_API_KEY", parsed.data.apiKey, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "integration.cfo_api_key_updated",
    entityType: "AppSetting",
    entityId: "CFO_API_KEY",
  });

  revalidatePath("/configuracoes/integracoes");
  return { success: true };
}

export async function removeCfoApiKey(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  await deleteAppSetting("CFO_API_KEY");

  await logActivity({
    userId: session.user.id,
    action: "integration.cfo_api_key_removed",
    entityType: "AppSetting",
    entityId: "CFO_API_KEY",
  });

  revalidatePath("/configuracoes/integracoes");
  return { success: true };
}

export async function logoutWhatsappService(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const result = await callWhatsappService("/logout");
  revalidatePath("/configuracoes/integracoes");
  return result;
}

export async function reconnectWhatsappService(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const result = await callWhatsappService("/reconnect");
  if (result.success) await waitUntilSettled();
  revalidatePath("/configuracoes/integracoes");
  return result;
}

export async function stopWhatsappService(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const response = await callWhatsappService("/shutdown");
  revalidatePath("/configuracoes/integracoes");
  // O processo pode encerrar antes de terminar a resposta — o que importa é
  // se ele parou de fato.
  if (!response.success && (await waitUntilStopped(3000))) return { success: true };
  return response;
}

export async function startWhatsappService(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  if (await isServiceHealthy()) {
    revalidatePath("/configuracoes/integracoes");
    return { success: false, error: "O serviço já está rodando." };
  }

  const result = await startLocalService();
  revalidatePath("/configuracoes/integracoes");
  return result;
}

// Parar + iniciar de novo — também é o jeito de o serviço reler o próprio
// .env (ex.: depois de corrigir o WEBHOOK_SECRET).
export async function restartWhatsappService(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  if (await isServiceHealthy()) {
    // Com o segredo errado o /shutdown é recusado; nesse caso não há como
    // derrubar o processo daqui.
    const stopped = await callWhatsappService("/shutdown");
    if (!(await waitUntilStopped())) {
      return {
        success: false,
        error: stopped.success
          ? "O serviço não encerrou a tempo. Tente novamente em alguns segundos."
          : `Não foi possível parar o serviço: ${stopped.error}`,
      };
    }
  }

  const result = await startLocalService();
  revalidatePath("/configuracoes/integracoes");
  return result;
}

// Escolha do provider do WhatsApp (Configurações > Integrações). Vale pras
// conversas NOVAS — as já existentes continuam no provider com que foram
// criadas até o cliente escrever de novo pelo canal novo.
export async function setWhatsappProvider(input: WhatsappProviderInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = whatsappProviderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Provider inválido." };

  await setAppSetting(WHATSAPP_PROVIDER_SETTING, parsed.data.provider, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "integration.whatsapp_provider_changed",
    entityType: "AppSetting",
    entityId: WHATSAPP_PROVIDER_SETTING,
    metadata: { provider: parsed.data.provider },
  });

  revalidatePath("/configuracoes/integracoes");
  return { success: true };
}

export async function saveWhatsappCloudConfig(input: WhatsappCloudConfigInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = whatsappCloudConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { phoneNumberId, accessToken, appSecret } = parsed.data;
  if (phoneNumberId) await setAppSetting(WHATSAPP_CLOUD_KEYS.phoneNumberId, phoneNumberId, session.user.id);
  if (accessToken) await setAppSetting(WHATSAPP_CLOUD_KEYS.accessToken, accessToken, session.user.id);
  if (appSecret) await setAppSetting(WHATSAPP_CLOUD_KEYS.appSecret, appSecret, session.user.id);

  await logActivity({
    userId: session.user.id,
    action: "integration.whatsapp_cloud_config_updated",
    entityType: "AppSetting",
    entityId: "WHATSAPP_CLOUD",
    metadata: { phoneNumberId: !!phoneNumberId, accessToken: !!accessToken, appSecret: !!appSecret },
  });

  revalidatePath("/configuracoes/integracoes");
  return { success: true };
}

// Verify token = senha que a gente inventa e cola no painel da Meta junto
// com a URL do webhook. Gerado aqui pra ninguém precisar inventar um.
export async function generateWhatsappCloudVerifyToken(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  await setAppSetting(WHATSAPP_CLOUD_KEYS.verifyToken, randomBytes(24).toString("hex"), session.user.id);
  revalidatePath("/configuracoes/integracoes");
  return { success: true };
}

export async function removeWhatsappCloudConfig(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  await Promise.all(Object.values(WHATSAPP_CLOUD_KEYS).map((key) => deleteAppSetting(key)));

  await logActivity({
    userId: session.user.id,
    action: "integration.whatsapp_cloud_config_removed",
    entityType: "AppSetting",
    entityId: "WHATSAPP_CLOUD",
  });

  revalidatePath("/configuracoes/integracoes");
  return { success: true };
}

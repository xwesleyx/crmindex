import { getWhatsappCloudConfig, graphUrl } from "@/features/integrations/whatsapp-cloud-config";

// Consulta o whatsapp-service/ (Python) pra tela de Integrações — só roda no
// servidor, o segredo nunca chega ao browser (seção "Integrações" do
// adendo de Atendimento).
export type WhatsappUnreachableReason = "offline" | "unauthorized" | "error";

export type WhatsappStatus =
  | { configured: false }
  | { configured: true; reachable: false; reason: WhatsappUnreachableReason; detail: string }
  | {
      configured: true;
      reachable: true;
      connected: boolean;
      // Deslogado: só volta a parear com "Gerar QR novamente".
      loggedOut: boolean;
      number: string | null;
      qr: string | null;
    };

type ServiceResult = { ok: true; body: unknown } | { ok: false; reason: WhatsappUnreachableReason; detail: string };

async function callService(path: string): Promise<ServiceResult> {
  const base = process.env.WHATSAPP_SERVICE_URL!.replace(/\/$/, "");
  const secret = process.env.WHATSAPP_SERVICE_SECRET!;

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      reason: "offline",
      detail: timedOut
        ? `O serviço em ${base} não respondeu em 5 segundos.`
        : `Nada respondendo em ${base} — o serviço está parado.`,
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      reason: "unauthorized",
      detail:
        "O serviço está rodando, mas recusou o segredo: WHATSAPP_SERVICE_SECRET (.env do CRM) e WEBHOOK_SECRET (whatsapp-service/.env) estão diferentes.",
    };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    return { ok: false, reason: "error", detail: `Erro ${response.status} no serviço${body?.detail ? `: ${body.detail}` : "."}` };
  }

  try {
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, reason: "error", detail: `Resposta inválida de ${base}${path} — a URL aponta mesmo pro whatsapp-service?` };
  }
}

export async function getWhatsappStatus(): Promise<WhatsappStatus> {
  const base = process.env.WHATSAPP_SERVICE_URL;
  const secret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!base || !secret) return { configured: false };

  const result = await callService("/status");
  if (!result.ok) return { configured: true, reachable: false, reason: result.reason, detail: result.detail };
  const status = result.body as { connected: boolean; number: string | null; qrPending: boolean; loggedOut?: boolean };

  let qr: string | null = null;
  if (!status.connected && status.qrPending) {
    const qrResult = await callService("/qr");
    const qrBody = qrResult.ok ? (qrResult.body as { available: boolean; qr?: string }) : null;
    qr = qrBody?.available ? (qrBody.qr ?? null) : null;
  }

  return {
    configured: true,
    reachable: true,
    connected: status.connected,
    loggedOut: status.loggedOut ?? false,
    number: status.number,
    qr,
  };
}

// Status da API oficial (Meta) — consulta o próprio número na Graph API, o
// que também confirma que o token é válido e tem acesso a esse número.
export type WhatsappCloudStatus =
  | { configured: false; hasAccessToken: boolean; phoneNumberId: string | null; hasAppSecret: boolean; verifyToken: string | null }
  | { configured: true; ok: false; error: string; verifyToken: string | null; phoneNumberId: string }
  | {
      configured: true;
      ok: true;
      verifyToken: string | null;
      phoneNumberId: string;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      qualityRating: string | null;
    };

export async function getWhatsappCloudStatus(): Promise<WhatsappCloudStatus> {
  const config = await getWhatsappCloudConfig();

  if (!config.accessToken || !config.phoneNumberId || !config.appSecret) {
    return {
      configured: false,
      hasAccessToken: !!config.accessToken,
      phoneNumberId: config.phoneNumberId,
      hasAppSecret: !!config.appSecret,
      verifyToken: config.verifyToken,
    };
  }

  const base = { configured: true as const, verifyToken: config.verifyToken, phoneNumberId: config.phoneNumberId };

  try {
    const response = await fetch(
      graphUrl(`${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`),
      { headers: { Authorization: `Bearer ${config.accessToken}` }, cache: "no-store" }
    );
    const body = (await response.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { ...base, ok: false, error: body.error?.message ?? `Erro ${response.status} na Graph API.` };
    }
    return {
      ...base,
      ok: true,
      displayPhoneNumber: body.display_phone_number ?? null,
      verifiedName: body.verified_name ?? null,
      qualityRating: body.quality_rating ?? null,
    };
  } catch (error) {
    return { ...base, ok: false, error: String(error) };
  }
}

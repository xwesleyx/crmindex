import { getDefaultProviderName } from "@/features/atendimento/providers/registry";
import { whatsappCloudProvider } from "@/features/atendimento/providers/whatsapp-cloud-provider";
import { withBrazilCountryCode } from "@/lib/validators";

export type SendResult = { ok: boolean; error?: string };

// Mensagem interna (lembrete pro responsável) — fala direto com o
// whatsapp-service, sem passar pelo MessageProvider/Conversation da Central
// de Atendimento (isso aqui não é uma conversa com cliente, é um alerta
// interno pro atendente/vendedor/técnico).
export async function sendInternalWhatsAppMessage(phone: string, text: string): Promise<SendResult> {
  // Com a API oficial ativa, sai pela Meta (sujeito à regra das 24h — o
  // destinatário precisa ter mandado mensagem pro número da empresa
  // recentemente, senão a Meta recusa).
  if ((await getDefaultProviderName()) === "whatsapp_cloud") {
    const result = await whatsappCloudProvider.sendMessage({
      conversationId: "",
      to: phone,
      channelIdentifier: null,
      content: text,
      type: "TEXT",
    });
    return result.status === "SENT" ? { ok: true } : { ok: false, error: "Falha ao enviar pela API oficial do WhatsApp." };
  }

  const base = process.env.WHATSAPP_SERVICE_URL;
  const secret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!base || !secret) {
    return { ok: false, error: "WHATSAPP_SERVICE_URL/WHATSAPP_SERVICE_SECRET não configurado." };
  }

  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: withBrazilCountryCode(phone), text }),
    });
    const body = (await response.json()) as { status?: string; error?: string };
    if (!response.ok || body.status !== "SENT") {
      return { ok: false, error: body.error ?? response.statusText };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { receiveInboundMessage } from "@/features/atendimento/actions";
import { neonizeProvider } from "@/features/atendimento/providers/neonize-provider";

// Webhook chamado pelo whatsapp-service/ (Python) a cada mensagem recebida
// no WhatsApp real — serviço-a-serviço, não passa pela sessão do Auth.js
// (não tem usuário logado aqui), por isso o segredo compartilhado.
export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_SERVICE_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const normalized = neonizeProvider.normalizeInbound(payload);
  if (!normalized.fromPhone) {
    return NextResponse.json({ error: "missing fromPhone" }, { status: 400 });
  }

  const result = await receiveInboundMessage({
    phone: normalized.fromPhone,
    name: normalized.fromName ?? undefined,
    content: normalized.content,
    type: normalized.type,
    mediaUrl: normalized.mediaUrl,
    channelIdentifier: normalized.channelIdentifier,
    providerMessageId: normalized.providerMessageId,
    provider: neonizeProvider.name,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, conversationId: result.data.conversationId });
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { receiveInboundMessage } from "@/features/atendimento/actions";
import { whatsappCloudProvider } from "@/features/atendimento/providers/whatsapp-cloud-provider";
import { getWhatsappCloudConfig } from "@/features/integrations/whatsapp-cloud-config";
import { prisma } from "@/lib/prisma";

// Webhook da API oficial do WhatsApp (Meta). A URL desta rota + o "Verify
// token" são colados no painel do app da Meta (WhatsApp > Configuração).
// Rota pública (fora do proxy de login) — a autenticidade vem da
// assinatura X-Hub-Signature-256 (HMAC do corpo com o App Secret).

// Verificação feita pela Meta ao salvar o webhook no painel: devolve o
// hub.challenge só se o verify token bater.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { verifyToken } = await getWhatsappCloudConfig();

  if (
    params.get("hub.mode") === "subscribe" &&
    verifyToken &&
    params.get("hub.verify_token") === verifyToken
  ) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function isValidSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const received = Buffer.from(header.slice("sha256=".length));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Ordem dos status — um "delivered" atrasado nunca rebaixa um "read".
const STATUS_RANK = { SENT: 1, DELIVERED: 2, READ: 3 } as const;
const STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

type CloudValue = {
  metadata?: { phone_number_id?: string };
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  messages?: Record<string, unknown>[];
  statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string }[] }[];
};

async function applyStatus(status: NonNullable<CloudValue["statuses"]>[number]) {
  const next = status.status ? STATUS_MAP[status.status] : undefined;
  if (!status.id || !next) return;

  if (next === "FAILED") {
    console.error("WhatsApp Cloud: mensagem falhou", status.id, status.errors?.[0]);
    await prisma.message.updateMany({ where: { providerMessageId: status.id }, data: { status: "FAILED" } });
    return;
  }

  const lowerStatuses = (Object.keys(STATUS_RANK) as (keyof typeof STATUS_RANK)[]).filter(
    (s) => STATUS_RANK[s] < STATUS_RANK[next]
  );
  await prisma.message.updateMany({
    where: { providerMessageId: status.id, status: { in: ["PENDING", ...lowerStatuses] } },
    data: { status: next },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const { appSecret } = await getWhatsappCloudConfig();

  if (!appSecret || !isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { entry?: { changes?: { field?: string; value?: CloudValue }[] }[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const value = change.value;

      for (const status of value.statuses ?? []) {
        await applyStatus(status);
      }

      for (const message of value.messages ?? []) {
        // Reação (emoji numa mensagem) não vira mensagem nova na conversa.
        if (message.type === "reaction") continue;

        const contact = value.contacts?.find((c) => c.wa_id === message.from) ?? value.contacts?.[0];
        const normalized = whatsappCloudProvider.normalizeInbound({
          message,
          contactName: contact?.profile?.name,
          phoneNumberId: value.metadata?.phone_number_id,
        });
        if (!normalized.fromPhone) continue;

        const result = await receiveInboundMessage({
          phone: normalized.fromPhone,
          name: normalized.fromName ?? undefined,
          content: normalized.content,
          type: normalized.type,
          mediaUrl: normalized.mediaUrl,
          channelIdentifier: normalized.channelIdentifier,
          providerMessageId: normalized.providerMessageId,
          provider: whatsappCloudProvider.name,
        });
        if (!result.success) {
          // 500 faz a Meta reenviar o evento depois (idempotente pelo
          // providerMessageId, então não duplica o que já entrou).
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

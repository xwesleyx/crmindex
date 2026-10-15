import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { graphUrl, getWhatsappCloudConfig } from "@/features/integrations/whatsapp-cloud-config";

// Mídia da API oficial do WhatsApp (foto/vídeo/áudio/documento) — a Meta só
// entrega o arquivo com o token, então o navegador nunca acessa a Meta
// direto: pede aqui (logado no CRM) e esta rota busca e repassa. A Meta
// guarda cada mídia por ~30 dias; depois disso responde 404.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ mediaId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { mediaId } = await ctx.params;
  const { accessToken } = await getWhatsappCloudConfig();
  if (!accessToken) return NextResponse.json({ error: "not configured" }, { status: 404 });

  const headers = { Authorization: `Bearer ${accessToken}` };

  const metaResponse = await fetch(graphUrl(encodeURIComponent(mediaId)), { headers, cache: "no-store" });
  if (!metaResponse.ok) return NextResponse.json({ error: "media not found" }, { status: 404 });
  const meta = (await metaResponse.json()) as { url?: string; mime_type?: string };
  if (!meta.url) return NextResponse.json({ error: "media not found" }, { status: 404 });

  // O servidor de arquivos da Meta recusa download sem User-Agent.
  const file = await fetch(meta.url, { headers: { ...headers, "User-Agent": "integra-crm" }, cache: "no-store" });
  if (!file.ok || !file.body) return NextResponse.json({ error: "media unavailable" }, { status: 502 });

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": meta.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream",
      // O conteúdo de um mediaId nunca muda — pode ficar no cache do navegador.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

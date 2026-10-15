import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

// Mídia recebida/enviada pela Neonize (fotos, figurinhas, áudios, vídeos,
// documentos) passando pelo próprio CRM. O whatsapp-service guarda o
// arquivo e gravava no banco um link direto pra ele (PUBLIC_URL — ex.:
// http://192.168.x.x:8787/media/...), que quebra quando o IP da máquina muda
// ou o serviço só escuta em localhost. Aqui o CRM busca o arquivo por dentro
// (WHATSAPP_SERVICE_URL) e entrega pro navegador — funciona em qualquer
// computador, exige login e não depende do IP. Ver resolveMediaUrl.
const FILE_PATTERN = /^[a-f0-9]{32}(\.[a-z0-9]{1,5})?$/i;

export async function GET(request: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { file } = await ctx.params;
  const base = process.env.WHATSAPP_SERVICE_URL;
  if (!base || !FILE_PATTERN.test(file)) return new NextResponse(null, { status: 404 });

  // Repassa o Range — sem isso não dá pra avançar/voltar áudio e vídeo.
  const range = request.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(`${base.replace(/\/$/, "")}/media/${file}`, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new NextResponse(null, { status: upstream.status === 416 ? 416 : 404 });

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
    // Nome do arquivo é aleatório e nunca muda de conteúdo.
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  });
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

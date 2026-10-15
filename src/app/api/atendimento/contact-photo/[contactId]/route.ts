import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withBrazilCountryCode } from "@/lib/validators";

// Foto de perfil do WhatsApp do contato. Só existe pela Neonize
// (whatsapp-service/ → /profile-picture); a API oficial da Meta não expõe a
// foto do cliente, então ali sempre cai nas iniciais. O arquivo é repassado
// por aqui (e não pela URL do WhatsApp direto) pra URL nunca vazar e o
// navegador poder guardar em cache.
//
// Dois modos, pra não arriscar bloqueio do número por excesso de consultas:
// - normal (painel da conversa, tela do contato — uma conversa por vez):
//   consulta o WhatsApp e guarda uma cópia em disco;
// - `?cached=1` (lista de conversas, Quadro — muitos contatos de uma vez):
//   só devolve a cópia guardada, NUNCA consulta o WhatsApp. Sem cópia ainda,
//   a lista mostra as iniciais até alguém abrir a conversa uma vez.
const NOT_FOUND_HEADERS = { "Cache-Control": "private, max-age=3600" };
// Curto: assim que alguém abrir a conversa e a foto for guardada, a lista
// passa a mostrar em poucos minutos.
const CACHED_NOT_FOUND_HEADERS = { "Cache-Control": "private, max-age=300" };
const PHOTO_CACHE_DIR = path.join(process.cwd(), ".cache", "contact-photos");
const MAX_CACHED_BYTES = 1024 * 1024;

function cachePath(contactId: string): string | null {
  // id de banco (cuid) — nada de "/" ou "..", então não sai da pasta.
  return /^[a-z0-9]+$/i.test(contactId) ? path.join(PHOTO_CACHE_DIR, `${contactId}.jpg`) : null;
}

async function readCachedPhoto(file: string | null): Promise<Buffer | null> {
  if (!file) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

function photoResponse(bytes: Buffer | Uint8Array, maxAge: number) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": `private, max-age=${maxAge}` },
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ contactId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { contactId } = await ctx.params;
  const file = cachePath(contactId);

  if (request.nextUrl.searchParams.get("cached") === "1") {
    const cached = await readCachedPhoto(file);
    return cached ? photoResponse(cached, 3600) : new NextResponse(null, { status: 404, headers: CACHED_NOT_FOUND_HEADERS });
  }

  const base = process.env.WHATSAPP_SERVICE_URL;
  const secret = process.env.WHATSAPP_SERVICE_SECRET;
  if (!base || !secret) return new NextResponse(null, { status: 404, headers: NOT_FOUND_HEADERS });

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { phone: true, whatsapp: true },
  });
  const phone = contact?.whatsapp || contact?.phone;
  if (!phone) return new NextResponse(null, { status: 404, headers: NOT_FOUND_HEADERS });

  try {
    const lookup = await fetch(
      `${base.replace(/\/$/, "")}/profile-picture?phone=${encodeURIComponent(withBrazilCountryCode(phone))}`,
      { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" }
    );
    const body = lookup.ok ? ((await lookup.json()) as { url?: string | null }) : null;
    if (lookup.ok && !body?.url) {
      // Contato tirou a foto ou deixou privada: some da lista também.
      if (file) await rm(file, { force: true });
      return new NextResponse(null, { status: 404, headers: NOT_FOUND_HEADERS });
    }
    if (!body?.url) throw new Error("profile-picture indisponível");

    const image = await fetch(body.url, { cache: "no-store" });
    if (!image.ok) throw new Error(`download ${image.status}`);
    const bytes = Buffer.from(await image.arrayBuffer());

    if (file && bytes.length <= MAX_CACHED_BYTES && (image.headers.get("content-type") ?? "").includes("jpeg")) {
      await mkdir(PHOTO_CACHE_DIR, { recursive: true });
      await writeFile(file, bytes).catch(() => null);
    }
    return photoResponse(bytes, 21600);
  } catch {
    // whatsapp-service fora do ar: usa a cópia guardada, se houver; senão o
    // painel mostra as iniciais.
    const cached = await readCachedPhoto(file);
    return cached ? photoResponse(cached, 300) : new NextResponse(null, { status: 404, headers: NOT_FOUND_HEADERS });
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AVATAR_DATA_URL_PATTERN } from "@/lib/user-avatar";

// Foto de perfil de um usuário do CRM (ver lib/user-avatar.ts). Só pra quem
// está logado; a URL tem `?v=` da última atualização, então dá pra cachear.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({ where: { id }, select: { image: true } });
  const image = user?.image;
  if (!image || !AVATAR_DATA_URL_PATTERN.test(image)) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, max-age=60" } });
  }

  const [header, base64] = image.split(",", 2);
  const contentType = header.slice("data:".length, header.indexOf(";"));
  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

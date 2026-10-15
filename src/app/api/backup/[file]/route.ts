import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { backupFilePath } from "@/features/backup/service";

// Baixar um backup (Configurações > Backup) — só administrador, e só
// arquivos da pasta de backups no formato crm-backup-*.db.
export async function GET(_request: Request, ctx: { params: Promise<{ file: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { file } = await ctx.params;
  const fullPath = await backupFilePath(decodeURIComponent(file));
  if (!fullPath) return new NextResponse(null, { status: 404 });

  const { size } = await stat(fullPath);
  const body = Readable.toWeb(createReadStream(fullPath)) as ReadableStream;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}

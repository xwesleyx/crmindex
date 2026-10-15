import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { CURRENT_VERSION } from "@/lib/changelog";
import { readUpdaterStatus } from "@/features/license/state";

// Consultado pelas telas a cada ~20s (SystemUpdateWatcher): mostra o aviso
// "Sistema atualizando…" pra todo mundo e recarrega quando o CRM volta.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = await readUpdaterStatus();
  return NextResponse.json(
    { versao: CURRENT_VERSION, atualizador: status },
    { headers: { "Cache-Control": "no-store" } }
  );
}

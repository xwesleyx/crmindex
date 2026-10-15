"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGENDA_VIEWS, type AgendaView } from "@/features/agenda/schema";

type ActionResult = { success: true } | { success: false; error: string };

// Estrela nas abas da Agenda: a visão marcada abre sempre que a pessoa entra
// na Agenda sem escolher outra. null = tira a estrela (volta à Lista).
export async function setAgendaDefaultView(view: AgendaView | null): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Sessão expirada. Entre novamente." };
  if (view !== null && !AGENDA_VIEWS.includes(view)) return { success: false, error: "Visão inválida." };

  await prisma.user.update({ where: { id: session.user.id }, data: { agendaDefaultView: view } });
  revalidatePath("/agenda");
  return { success: true };
}

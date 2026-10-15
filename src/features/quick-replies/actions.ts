"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listQuickReplies } from "@/features/quick-replies/queries";
import { quickReplyFormSchema, type QuickReplyFormInput } from "@/features/quick-replies/schema";

type ActionResult = { success: true } | { success: false; error: string };

// Mesmo gate ADMIN-only de todo o resto de Configurações.
async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function createQuickReply(input: QuickReplyFormInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para gerenciar respostas rápidas." };

  const parsed = quickReplyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const shortcut = parsed.data.shortcut.toLowerCase();

  const existing = await prisma.quickReply.findUnique({ where: { shortcut } });
  if (existing) return { success: false, error: `Já existe uma resposta rápida com o atalho "/${shortcut}".` };

  const item = await prisma.quickReply.create({ data: { shortcut, message: parsed.data.message } });

  await logActivity({
    userId: session.user.id,
    action: "quick_reply.created",
    entityType: "QuickReply",
    entityId: item.id,
    metadata: { shortcut },
  });

  revalidatePath("/configuracoes/respostas-rapidas");
  return { success: true };
}

export async function updateQuickReply(id: string, input: QuickReplyFormInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para gerenciar respostas rápidas." };

  const existing = await prisma.quickReply.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Resposta rápida não encontrada." };

  const parsed = quickReplyFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const shortcut = parsed.data.shortcut.toLowerCase();

  const clash = await prisma.quickReply.findUnique({ where: { shortcut } });
  if (clash && clash.id !== id) {
    return { success: false, error: `Já existe uma resposta rápida com o atalho "/${shortcut}".` };
  }

  await prisma.quickReply.update({ where: { id }, data: { shortcut, message: parsed.data.message } });

  await logActivity({
    userId: session.user.id,
    action: "quick_reply.updated",
    entityType: "QuickReply",
    entityId: id,
  });

  revalidatePath("/configuracoes/respostas-rapidas");
  return { success: true };
}

export async function deleteQuickReply(id: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para gerenciar respostas rápidas." };

  const existing = await prisma.quickReply.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Resposta rápida não encontrada." };

  await prisma.quickReply.delete({ where: { id } });

  await logActivity({
    userId: session.user.id,
    action: "quick_reply.deleted",
    entityType: "QuickReply",
    entityId: id,
    metadata: { shortcut: existing.shortcut },
  });

  revalidatePath("/configuracoes/respostas-rapidas");
  return { success: true };
}

// Usado pelo composer do Atendimento (chat-panel.tsx) — qualquer perfil com
// acesso ao módulo (não só ADMIN) precisa conseguir listar pra usar o "/",
// só criar/editar/remover é restrito a Configurações.
export async function fetchQuickReplies(): Promise<{ id: string; shortcut: string; message: string }[]> {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "atendimento")) return [];
  return listQuickReplies();
}

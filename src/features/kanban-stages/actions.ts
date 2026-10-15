"use server";

import type { KanbanBoard } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PROTECTED_STAGE_KEYS } from "@/features/kanban/constants";
import { kanbanStageFormSchema, type KanbanStageFormInput } from "@/features/kanban-stages/schema";

type ActionResult = { success: true } | { success: false; error: string };

// Mesmo gate especial de Configurações (ADMIN-only) de features/regions e
// features/checklist-templates.
async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

function boardPath(board: KanbanBoard) {
  revalidatePath("/configuracoes/kanbans");
  revalidatePath(board === "COMMERCIAL" ? "/crm/kanban" : "/instalacoes/kanban");
}

export async function createKanbanStage(
  board: KanbanBoard,
  input: KanbanStageFormInput
): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o Kanban." };

  const parsed = kanbanStageFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const last = await prisma.kanbanStage.findFirst({ where: { board }, orderBy: { order: "desc" } });

  // Chave interna só pra satisfazer @@unique([board, key]) — etapas criadas
  // pela tela não precisam de uma chave "legível", só as 4 especiais
  // (Venda Ganha/Perdida, Concluída/Cancelada) têm significado pro código.
  const key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const stage = await prisma.kanbanStage.create({
    data: { ...parsed.data, board, key, order: (last?.order ?? 0) + 1 },
  });

  await logActivity({
    userId: session.user.id,
    action: "kanban_stage.created",
    entityType: "KanbanStage",
    entityId: stage.id,
    metadata: { board, name: stage.name },
  });

  boardPath(board);
  return { success: true };
}

export async function updateKanbanStage(id: string, input: KanbanStageFormInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o Kanban." };

  const existing = await prisma.kanbanStage.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Etapa não encontrada." };

  const parsed = kanbanStageFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.kanbanStage.update({ where: { id }, data: parsed.data });

  await logActivity({
    userId: session.user.id,
    action: "kanban_stage.updated",
    entityType: "KanbanStage",
    entityId: id,
  });

  boardPath(existing.board);
  return { success: true };
}

export async function toggleKanbanStageArchived(id: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o Kanban." };

  const existing = await prisma.kanbanStage.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Etapa não encontrada." };

  const isArchiving = !existing.deletedAt;

  if (isArchiving) {
    if (PROTECTED_STAGE_KEYS.includes(existing.key)) {
      return {
        success: false,
        error: "Esta etapa é usada pelas automações do sistema e não pode ser removida.",
      };
    }

    const [opportunityCount, installationCount] = await Promise.all([
      prisma.opportunity.count({ where: { stageId: id } }),
      prisma.installation.count({ where: { stageId: id } }),
    ]);
    const total = opportunityCount + installationCount;
    if (total > 0) {
      return {
        success: false,
        error: `Existem ${total} registro(s) nesta etapa — mova-os para outra etapa antes de remover.`,
      };
    }
  }

  await prisma.kanbanStage.update({
    where: { id },
    data: { deletedAt: isArchiving ? new Date() : null },
  });

  await logActivity({
    userId: session.user.id,
    action: isArchiving ? "kanban_stage.archived" : "kanban_stage.restored",
    entityType: "KanbanStage",
    entityId: id,
  });

  boardPath(existing.board);
  return { success: true };
}

export async function moveKanbanStage(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o Kanban." };

  const current = await prisma.kanbanStage.findUnique({ where: { id } });
  if (!current) return { success: false, error: "Etapa não encontrada." };

  const items = await prisma.kanbanStage.findMany({
    where: { board: current.board },
    orderBy: { order: "asc" },
  });
  const index = items.findIndex((i) => i.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return { success: true };

  const target = items[targetIndex];

  await prisma.$transaction([
    prisma.kanbanStage.update({ where: { id: current.id }, data: { order: target.order } }),
    prisma.kanbanStage.update({ where: { id: target.id }, data: { order: current.order } }),
  ]);

  boardPath(current.board);
  return { success: true };
}

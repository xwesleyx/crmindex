"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checklistTemplateItemFormSchema,
  type ChecklistTemplateItemFormInput,
} from "@/features/checklist-templates/schema";

type ActionResult = { success: true } | { success: false; error: string };

// Mesmo gate especial de Configurações (ADMIN-only) usado em
// features/regions/actions.ts e features/users/actions.ts.
async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function createChecklistTemplateItem(
  input: ChecklistTemplateItemFormInput
): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o checklist padrão." };

  const parsed = checklistTemplateItemFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const last = await prisma.checklistTemplateItem.findFirst({ orderBy: { order: "desc" } });

  const item = await prisma.checklistTemplateItem.create({
    data: { ...parsed.data, order: (last?.order ?? 0) + 1 },
  });

  await logActivity({
    userId: session.user.id,
    action: "checklist_template.created",
    entityType: "ChecklistTemplateItem",
    entityId: item.id,
    metadata: { label: item.label },
  });

  revalidatePath("/configuracoes/checklist");
  return { success: true };
}

export async function updateChecklistTemplateItem(
  id: string,
  input: ChecklistTemplateItemFormInput
): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o checklist padrão." };

  const existing = await prisma.checklistTemplateItem.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Item não encontrado." };

  const parsed = checklistTemplateItemFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await prisma.checklistTemplateItem.update({ where: { id }, data: parsed.data });

  await logActivity({
    userId: session.user.id,
    action: "checklist_template.updated",
    entityType: "ChecklistTemplateItem",
    entityId: id,
  });

  revalidatePath("/configuracoes/checklist");
  return { success: true };
}

export async function deleteChecklistTemplateItem(id: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o checklist padrão." };

  const existing = await prisma.checklistTemplateItem.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Item não encontrado." };

  // Sem soft-delete aqui de propósito (diferente de Region/Lead/etc): nada
  // referencia este registro por FK — cada instalação já nasceu com sua
  // PRÓPRIA cópia do item em InstallationChecklistItem, então apagar o
  // template não afeta nenhuma instalação existente.
  await prisma.checklistTemplateItem.delete({ where: { id } });

  await logActivity({
    userId: session.user.id,
    action: "checklist_template.deleted",
    entityType: "ChecklistTemplateItem",
    entityId: id,
    metadata: { label: existing.label },
  });

  revalidatePath("/configuracoes/checklist");
  return { success: true };
}

export async function moveChecklistTemplateItem(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar o checklist padrão." };

  const items = await prisma.checklistTemplateItem.findMany({ orderBy: { order: "asc" } });
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return { success: false, error: "Item não encontrado." };

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return { success: true };

  const current = items[index];
  const target = items[targetIndex];

  await prisma.$transaction([
    prisma.checklistTemplateItem.update({ where: { id: current.id }, data: { order: target.order } }),
    prisma.checklistTemplateItem.update({ where: { id: target.id }, data: { order: current.order } }),
  ]);

  revalidatePath("/configuracoes/checklist");
  return { success: true };
}

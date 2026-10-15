"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regionFormSchema, type RegionFormInput } from "@/features/regions/schema";

type ActionResult = { success: true } | { success: false; error: string };

// Regiões vivem em Configurações, que hoje é ADMIN-only (mesmo gate especial
// de src/lib/permissions.ts: canAccessModule trata "configuracoes" à parte
// de ROLE_MODULES) — segue o mesmo padrão de features/users/actions.ts.
async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function createRegion(input: RegionFormInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para criar regiões." };

  const parsed = regionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existing = await prisma.region.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return existing.deletedAt
      ? { success: false, error: "Já existe uma região arquivada com este nome — restaure-a em vez de criar outra." }
      : { success: false, error: "Já existe uma região com este nome." };
  }

  const region = await prisma.region.create({ data: parsed.data });

  await logActivity({
    userId: session.user.id,
    action: "region.created",
    entityType: "Region",
    entityId: region.id,
    metadata: { name: region.name },
  });

  revalidatePath("/configuracoes/regioes");
  return { success: true };
}

export async function updateRegion(id: string, input: RegionFormInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para editar regiões." };

  const existing = await prisma.region.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Região não encontrada." };

  const parsed = regionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (parsed.data.name !== existing.name) {
    const duplicate = await prisma.region.findUnique({ where: { name: parsed.data.name } });
    if (duplicate) return { success: false, error: "Já existe uma região com este nome." };
  }

  await prisma.region.update({ where: { id }, data: parsed.data });

  await logActivity({
    userId: session.user.id,
    action: "region.updated",
    entityType: "Region",
    entityId: id,
  });

  revalidatePath("/configuracoes/regioes");
  return { success: true };
}

export async function toggleRegionArchived(id: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  if (!session) return { success: false, error: "Você não tem permissão para arquivar regiões." };

  const existing = await prisma.region.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Região não encontrada." };

  const isArchiving = !existing.deletedAt;

  // A região padrão é usada automaticamente em toda Empresa/Cliente sem
  // região escolhida (getDefaultRegionId) — arquivá-la deixaria esse
  // preenchimento automático sem destino.
  if (isArchiving && existing.isDefault) {
    return { success: false, error: "Esta é a região padrão do sistema e não pode ser arquivada." };
  }

  await prisma.region.update({
    where: { id },
    data: { deletedAt: isArchiving ? new Date() : null },
  });

  await logActivity({
    userId: session.user.id,
    action: isArchiving ? "region.archived" : "region.restored",
    entityType: "Region",
    entityId: id,
  });

  revalidatePath("/configuracoes/regioes");
  return { success: true };
}

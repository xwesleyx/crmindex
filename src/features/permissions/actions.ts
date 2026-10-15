"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";
import {
  updatePermissionOverrideSchema,
  type UpdatePermissionOverrideInput,
} from "@/features/permissions/schema";

type ActionResult = { success: true } | { success: false; error: string };

// Aditivo sobre o perfil (UserRole) — nunca mexe em role/status, só grava o
// que diverge do padrão do perfil. Qualquer Administrador pode editar,
// inclusive outro Administrador (Configurações nunca entra nos ajustes, então
// ninguém perde o acesso a esta tela).
export async function updateUserPermissionOverride(
  userId: string,
  input: UpdatePermissionOverrideInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = updatePermissionOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: "Usuário não encontrado." };
  if (isSuperAdmin(target.email) && !isSuperAdmin(session.user.email)) {
    return { success: false, error: "O usuário do suporte não pode ser alterado." };
  }

  const { modulesGranted, modulesRevoked, capabilities } = parsed.data;

  await prisma.userPermissionOverride.upsert({
    where: { userId },
    create: {
      userId,
      modulesGranted: JSON.stringify(modulesGranted),
      modulesRevoked: JSON.stringify(modulesRevoked),
      capabilities: JSON.stringify(capabilities),
      updatedBy: session.user.id,
    },
    update: {
      modulesGranted: JSON.stringify(modulesGranted),
      modulesRevoked: JSON.stringify(modulesRevoked),
      capabilities: JSON.stringify(capabilities),
      updatedBy: session.user.id,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "permission.updated",
    entityType: "User",
    entityId: userId,
    metadata: { modulesGranted, modulesRevoked, capabilities },
  });

  revalidatePath("/configuracoes/permissoes");
  revalidatePath("/", "layout");
  return { success: true };
}

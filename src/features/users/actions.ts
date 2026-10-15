"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onlyDigits } from "@/lib/validators";
import { isValidAvatarDataUrl } from "@/lib/user-avatar";
import { isSuperAdmin } from "@/lib/super-admin";
import {
  createUserSchema,
  updateOwnProfileSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateOwnProfileInput,
  type UpdateUserInput,
} from "@/features/users/schema";

type ActionResult =
  | { success: true }
  | { success: false; error: string };

const SUPPORT_USER_LOCKED = { success: false as const, error: "O usuário do suporte não pode ser alterado." };

// Usuário do suporte (lib/super-admin.ts): só ele mesmo se altera.
function isProtectedFrom(actorEmail: string | null | undefined, target: { email: string }): boolean {
  return isSuperAdmin(target.email) && !isSuperAdmin(actorEmail);
}

export async function createUser(input: CreateUserInput): Promise<ActionResult> {
  const session = await auth();
  // Autorização validada no servidor, não apenas escondendo o botão na UI.
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { name, email, password, role, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Já existe um usuário com este e-mail." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email, role, passwordHash, phone: phone ? onlyDigits(phone) : null },
  });

  await logActivity({
    userId: session.user.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    metadata: { role },
  });

  revalidatePath("/configuracoes/usuarios");
  return { success: true };
}

// ADMIN edita qualquer usuário (nome, e-mail, telefone e, opcionalmente,
// define uma senha nova — é reset, não precisa da senha atual).
export async function updateUser(userId: string, input: UpdateUserInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { success: false, error: "Usuário não encontrado." };
  if (isProtectedFrom(session.user.email, target)) return SUPPORT_USER_LOCKED;

  const { name, email, phone, newPassword } = parsed.data;
  if (isSuperAdmin(target.email) && email.trim().toLowerCase() !== target.email) {
    return { success: false, error: "O e-mail do usuário do suporte não pode ser alterado." };
  }

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== userId) {
    return { success: false, error: "Já existe um usuário com este e-mail." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      phone: phone ? onlyDigits(phone) : null,
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}),
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "user.update",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/configuracoes/usuarios");
  return { success: true };
}

// Autoatendimento — qualquer usuário logado edita o próprio nome/e-mail/
// telefone; trocar a senha exige confirmar a atual.
export async function updateOwnProfile(input: UpdateOwnProfileInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Você precisa estar logado." };
  }

  const parsed = updateOwnProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { name, email, phone, currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { success: false, error: "Usuário não encontrado." };
  if (isSuperAdmin(user.email) && email.trim().toLowerCase() !== user.email) {
    return { success: false, error: "O e-mail do usuário do suporte não pode ser alterado." };
  }

  if (newPassword) {
    const matches = user.passwordHash ? await bcrypt.compare(currentPassword ?? "", user.passwordHash) : false;
    if (!matches) {
      return { success: false, error: "Senha atual incorreta." };
    }
  }

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== user.id) {
    return { success: false, error: "Já existe um usuário com este e-mail." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      email,
      phone: phone ? onlyDigits(phone) : null,
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}),
    },
  });

  await logActivity({
    userId: user.id,
    action: "user.update_profile",
    entityType: "User",
    entityId: user.id,
  });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function toggleUserStatus(userId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }

  if (userId === session.user.id) {
    return { success: false, error: "Você não pode desativar seu próprio usuário." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { success: false, error: "Usuário não encontrado." };
  }
  if (isProtectedFrom(session.user.email, target)) return SUPPORT_USER_LOCKED;

  const nextStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });

  await logActivity({
    userId: session.user.id,
    action: nextStatus === "ACTIVE" ? "user.activate" : "user.deactivate",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/configuracoes/usuarios");
  return { success: true };
}

// Foto de perfil (Meu perfil e Configurações > Usuários). `image` null =
// remover a foto (volta às iniciais).
async function saveAvatar(userId: string, image: string | null, actorId: string): Promise<ActionResult> {
  if (image !== null && !isValidAvatarDataUrl(image)) {
    return { success: false, error: "Imagem inválida ou grande demais. Use uma foto JPG, PNG ou WEBP." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true } });
  if (!target || target.deletedAt) return { success: false, error: "Usuário não encontrado." };

  await prisma.user.update({ where: { id: userId }, data: { image } });
  await logActivity({
    userId: actorId,
    action: image ? "user.avatar_updated" : "user.avatar_removed",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/configuracoes/usuarios");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateOwnAvatar(image: string | null): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Sessão expirada. Entre novamente." };
  return saveAvatar(session.user.id, image, session.user.id);
}

export async function updateUserAvatar(userId: string, image: string | null): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Você não tem permissão para esta ação." };
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (target && isProtectedFrom(session.user.email, target)) return SUPPORT_USER_LOCKED;
  return saveAvatar(userId, image, session.user.id);
}

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMyNotifications } from "@/features/notifications/queries";
import type { NotificationItem } from "@/features/notifications/types";

type ActionResult = { success: true } | { success: false; error: string };

// Chamada tanto no primeiro carregamento do sino (o layout só manda a
// contagem inicial, pra não atrasar o render da página toda) quanto a cada
// tick do polling client-side (NotificationBell) — sempre a visão mais
// recente de "minhas notificações".
export async function fetchMyNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
} | null> {
  const session = await auth();
  if (!session?.user) return null;
  return getMyNotifications(session.user.id);
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autenticado." };

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== session.user.id) {
    return { success: false, error: "Notificação não encontrada." };
  }

  if (!notification.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
  return { success: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autenticado." };

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return { success: true };
}

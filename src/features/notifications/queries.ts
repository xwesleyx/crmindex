import { prisma } from "@/lib/prisma";
import type { NotificationItem } from "@/features/notifications/types";

// Sino do cabeçalho: só as N mais recentes (lidas ou não) — não é uma central
// de notificações com histórico completo/paginação, é um resumo rápido.
const BELL_LIMIT = 20;

export async function getMyNotifications(userId: string): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: BELL_LIMIT,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      link: row.link,
      read: row.readAt !== null,
      createdAt: row.createdAt,
    })),
    unreadCount,
  };
}

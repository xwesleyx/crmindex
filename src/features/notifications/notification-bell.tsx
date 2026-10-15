"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Toasts genéricos (sucesso/erro de formulário) ficam do jeito padrão — só
// o pop-up de notificação usa esse ícone e essa largura, pra separar
// visualmente "algo aconteceu no sistema" de "sua ação deu certo/errado", e
// pra caber título + mensagem + data sem quebrar feio (pedido: "melhore o
// layout" do popup de notificação).
const NOTIFICATION_TOAST_STYLE = { width: "24rem", alignItems: "flex-start" as const };

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";
import { formatRelative } from "@/lib/format";
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import type { NotificationItem } from "@/features/notifications/types";

const POLL_MS = 20_000;
// Duração pedida: "apareça um pop-up... e depois saia com uns 10 segundos".
const TOAST_DURATION_MS = 10_000;

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  // Refs (não state) porque `poll` é criada uma vez só (efeito com deps
  // vazias, roda em loop via setInterval) — se fossem state, cada tick leria
  // sempre o valor da primeira renderização (closure presa), nunca a
  // atualização feita pelo tick anterior.
  const mountedAtRef = useRef(new Date());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const result = await fetchMyNotifications();
      if (cancelled || !result) return;

      // Só notificações criadas DEPOIS que o sino montou e vistas pela
      // primeira vez viram pop-up — sem isso, toda notificação não lida de
      // antes (ex: de ontem) apareceria como toast assim que a página
      // carregasse.
      if (hasLoadedOnceRef.current) {
        const newOnes = result.items.filter(
          (item) => !seenIdsRef.current.has(item.id) && item.createdAt > mountedAtRef.current
        );
        for (const item of newOnes.reverse()) {
          toast(item.title, {
            description: item.message,
            duration: TOAST_DURATION_MS,
            icon: <Bell className="size-4" />,
            style: NOTIFICATION_TOAST_STYLE,
          });
        }
      }
      for (const item of result.items) seenIdsRef.current.add(item.id);

      setItems(result.items);
      setUnreadCount(result.unreadCount);
      hasLoadedOnceRef.current = true;
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleOpenItem(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      const result = await markNotificationRead(item.id);
      if (!result.success) router.refresh();
    }
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
            <Bell className="size-4.5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 size-4.5 justify-center rounded-full p-0 text-[10px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação por enquanto.
          </div>
        ) : (
          <div className="flex max-h-96 flex-col overflow-y-auto">
            {items.map((item) => {
              const content = (
                <div
                  className={cn(
                    "flex items-start gap-2 px-2 py-2 text-sm hover:bg-muted",
                    !item.read && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      item.read ? "bg-transparent" : "bg-primary"
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className={cn("truncate font-medium", item.read && "font-normal text-muted-foreground")}>
                      {item.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                    <p className="text-[10px] text-muted-foreground/70">{formatRelative(item.createdAt)}</p>
                  </div>
                </div>
              );

              if (item.link) {
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="block w-full text-left"
                    onClick={() => handleOpenItem(item)}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => handleOpenItem(item)}
                >
                  {content}
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

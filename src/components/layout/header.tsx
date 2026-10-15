"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, Menu, Search, UserCog } from "lucide-react";
import { useState } from "react";

import { NAV_GROUPS, ROLE_LABELS } from "@/components/layout/nav-config";
import { SETTINGS_TAB_GROUPS } from "@/features/settings/tab-groups";

// Segmentos de URL sem tela própria no menu (ex.: "/configuracoes" sozinho)
// e as telas que viraram aba — sem isso o breadcrumb mostrava o slug cru.
const EXTRA_CRUMB_LABELS: Record<string, string> = {
  "/configuracoes": "Configurações",
  ...Object.fromEntries(
    Object.values(SETTINGS_TAB_GROUPS).flatMap((group) => group.tabs.map((tab) => [tab.href, tab.label]))
  ),
};
import { formatEntityCodeForRoute, looksLikeEntityId } from "@/lib/entity-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityAvatar } from "@/components/entity-avatar";
import { Input } from "@/components/ui/input";
import { signOutAction } from "@/features/auth/actions";
import { MyProfileDialog } from "@/features/users/my-profile-dialog";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { NotificationBell } from "@/features/notifications/notification-bell";
import type { UserRole } from "@prisma/client";

type HeaderProps = {
  user: { name: string; email: string; role: UserRole; phone: string | null; avatarSrc: string | null };
  unreadCount: number;
  onOpenMobileMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

function useBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const group = NAV_GROUPS.find((g) => g.href === href);
    const item = NAV_GROUPS.flatMap((g) => g.items ?? []).find(
      (i) => i.href === href
    );
    const parentSegment = segments[index - 1];
    const label =
      EXTRA_CRUMB_LABELS[href] ??
      item?.label ??
      group?.label ??
      (looksLikeEntityId(segment) && parentSegment
        ? formatEntityCodeForRoute(parentSegment, segment)
        : segment.charAt(0).toUpperCase() + segment.slice(1));
    return { href, label };
  });

  return crumbs;
}

export function Header({ user, unreadCount, onOpenMobileMenu, theme, onToggleTheme }: HeaderProps) {
  const crumbs = useBreadcrumb();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background px-3 md:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobileMenu}
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </Button>

      <nav className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground md:flex">
        {crumbs.length === 0 ? (
          <span className="font-medium text-foreground">Dashboard</span>
        ) : (
          crumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {index > 0 && <span className="text-border">/</span>}
              {index === crumbs.length - 1 ? (
                <span className="font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))
        )}
      </nav>

      {/* Versão compacta do breadcrumb pro mobile — sem isso o espaço entre o
          hamburger e os ícones da direita fica vazio, sem indicar em que tela
          o usuário está (breadcrumb completo e busca só aparecem em md:). */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground md:hidden">
        {crumbs.length === 0 ? "Dashboard" : crumbs[crumbs.length - 1].label}
      </span>

      <div className="relative ml-auto hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes, leads, oportunidades..."
          className="pl-8"
          disabled
          title="Busca global chega na Fase 2+"
        />
      </div>

      <ModeToggle theme={theme} onToggle={onToggleTheme} />

      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        aria-label="Ajuda"
        title="Central de Ajuda"
        render={<a href="/ajuda" target="_blank" rel="noopener noreferrer" />}
      >
        <CircleHelp className="size-4.5" />
      </Button>

      <NotificationBell initialUnreadCount={unreadCount} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2 rounded-full outline-none">
              <EntityAvatar name={user.name} src={user.avatarSrc} />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
                <Badge variant="secondary" className="mt-1.5 w-fit text-[10px]">
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            nativeButton
            render={
              <button type="button" className="w-full text-left" onClick={() => setProfileOpen(true)}>
                <UserCog className="size-4" />
                Meu perfil
              </button>
            }
          />
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem
              nativeButton
              render={
                <button type="submit" className="w-full text-left">
                  <LogOut className="size-4" />
                  Sair
                </button>
              }
            />
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <MyProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        name={user.name}
        email={user.email}
        phone={user.phone}
        avatarSrc={user.avatarSrc}
      />
    </header>
  );
}

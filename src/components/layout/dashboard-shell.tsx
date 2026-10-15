"use client";

import { useState, type ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "cn";
import type { ResolvedPermissionOverrides } from "@/lib/permissions";
import { isSuperAdmin } from "@/lib/super-admin";
import { SystemUpdateWatcher } from "@/features/license/system-update-watcher";
import type { UserRole } from "@prisma/client";

type DashboardShellProps = {
  user: { name: string; email: string; role: UserRole; phone: string | null; avatarSrc: string | null };
  unreadCount: number;
  permissionOverrides: ResolvedPermissionOverrides;
  // Avisos do sistema acima da página (licença travada pro suporte, versão
  // nova pros administradores) — montados no layout (servidor).
  systemBanner?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  user,
  unreadCount,
  permissionOverrides,
  systemBanner,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useAppTheme();

  return (
    // text-foreground precisa estar aqui, não só bg-background: o <body> (lá
    // em app/layout.tsx) já define sua própria cor de texto fora do escopo
    // dessa div "dark", então qualquer título/parágrafo sem classe de cor
    // própria herdava a cor clara do body mesmo com o tema escuro ativo
    // (texto azul-marinho em vez de branco). Definindo a cor aqui, nessa
    // mesma div que ganha a classe "dark", tudo que não tem cor própria
    // passa a herdar a cor certa por baixo dela.
    <div className={cn("flex min-h-screen bg-background text-foreground", theme === "dark" && "dark")}>
      <Sidebar
        role={user.role}
        isSupport={isSuperAdmin(user.email)}
        permissionOverrides={permissionOverrides}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          user={user}
          unreadCount={unreadCount}
          onOpenMobileMenu={() => setMobileOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 p-4 lg:p-5">
          {systemBanner}
          {children}
        </main>
      </div>

      {/* Precisa estar dentro deste wrapper (não em Providers, lá fora do
          escopo "dark") — o `theme` real do app só existe aqui, e passar
          explicitamente evita a mesma armadilha do texto azul-marinho em
          modo escuro (comentário acima), agora pro popup de notificação. */}
      <Toaster theme={theme} />
      <SystemUpdateWatcher />
    </div>
  );
}

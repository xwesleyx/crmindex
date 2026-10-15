"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import { PenBookIcon } from "@/components/brand/pen-book-icon";
import { NAV_GROUPS, isNavItemActive } from "@/components/layout/nav-config";
import { isModuleVisible, type ModuleKey, type ResolvedPermissionOverrides } from "@/lib/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { UserRole } from "@prisma/client";

type SidebarProps = {
  role: UserRole;
  // Usuário do suporte (admin@crm.index): vê itens marcados supportOnly.
  isSupport: boolean;
  permissionOverrides: ResolvedPermissionOverrides;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({
  role,
  isSupport,
  permissionOverrides,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  // Grupo fica visível se o papel (+ overrides do usuário) acessa o módulo
  // do grupo OU (quando os itens têm módulo próprio, ex: Relatórios) pelo
  // menos um dos itens — cada item some individualmente logo abaixo se não
  // tiver acesso.
  const visibleGroups = NAV_GROUPS.filter(
    (group) =>
      isModuleVisible(role, group.module as ModuleKey, permissionOverrides) ||
      group.items?.some((item) =>
        isModuleVisible(role, item.module ?? (group.module as ModuleKey), permissionOverrides)
      )
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}

      {/* Sidebar em azul-marinho escuro — tokens --sidebar-* (globals.css),
          não bg-card: é a identidade visual da referência, não o padrão
          claro usado no resto do app. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 md:sticky md:top-0 md:translate-x-0",
          collapsed ? "w-15" : "w-[212px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-3">
          <div className="flex size-8.5 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <PenBookIcon className="size-5" />
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-white">
              INDEX
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2.5">
          <ul className="flex flex-col gap-0.5">
            {visibleGroups.map((group) => {
              // Nem todo item de um grupo compartilha o prefixo do
              // group.href (ex: "Vendas" mora em /vendas, fora de /crm, mas
              // é um item do grupo CRM) — checa o próprio item também, não
              // só o prefixo do grupo.
              const isActiveGroup = group.items
                ? group.items.some(
                    (item) =>
                      pathname.startsWith(item.href) ||
                      (item.activeHrefs?.some((href) => pathname.startsWith(href)) ?? false)
                  )
                : pathname.startsWith(group.href);
              const Icon = group.icon;

              const groupLink = (
                <Link
                  href={group.href}
                  onClick={onCloseMobile}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActiveGroup
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{group.label}</span>}
                </Link>
              );

              return (
                <li key={group.label}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger render={groupLink} />
                      <TooltipContent side="right">{group.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    groupLink
                  )}

                  {!collapsed && group.items && isActiveGroup && (
                    <ul className="ml-[2.15rem] mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                      {group.items
                        .filter(
                          (item) =>
                            (!item.supportOnly || isSupport) &&
                            isModuleVisible(role, item.module ?? (group.module as ModuleKey), permissionOverrides)
                        )
                        .map((item) => {
                        const isActiveItem = isNavItemActive(item, pathname);
                        return (
                          <li key={item.href}>
                            {item.ready ? (
                              <Link
                                href={item.href}
                                onClick={onCloseMobile}
                                className={cn(
                                  "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                                  isActiveItem
                                    ? "font-medium text-sidebar-primary"
                                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                                )}
                              >
                                {item.label}
                              </Link>
                            ) : (
                              <span className="flex cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/50">
                                {item.label}
                                <Badge
                                  variant="secondary"
                                  className="ml-2 h-4.5 border-transparent bg-sidebar-accent px-1.5 text-[10px] font-normal text-sidebar-foreground"
                                >
                                  Em breve
                                </Badge>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden w-full items-center justify-center gap-2 rounded-md py-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:flex"
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <>
                <ChevronsLeft className="size-4" />
                <span className="text-xs">Recolher</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

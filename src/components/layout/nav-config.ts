import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LineChart,
  MessageCircle,
  Settings,
  Wallet,
  Wrench,
} from "lucide-react";

import type { ModuleKey } from "@/lib/permissions";
import { tabHrefs } from "@/features/settings/tab-groups";

export type NavItem = {
  label: string;
  href: string;
  ready: boolean; // false = "Em breve" (fase futura, sem backend ainda)
  // Só usado quando um item dentro do grupo precisa de uma permissão
  // diferente da do grupo (ex: Relatórios — cada tipo é um módulo próprio).
  // Sem isso, o item herda `group.module`.
  module?: ModuleKey;
  // Outras rotas em que este item conta como ativo — telas que viraram aba
  // dele (ex.: Permissões é aba de Usuários) e saíram do menu.
  activeHrefs?: string[];
  // Só para o usuário do suporte (admin@crm.index) — ex.: Licença.
  supportOnly?: boolean;
};

export type NavGroup = {
  label: string;
  module: ModuleKey;
  icon: LucideIcon;
  href: string;
  items?: NavItem[];
};

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || (item.activeHrefs?.includes(pathname) ?? false);
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Dashboard",
    module: "dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "CRM",
    module: "crm",
    icon: LineChart,
    href: "/crm/leads",
    items: [
      { label: "Leads", href: "/crm/leads", ready: true },
      { label: "Prospecção CNPJ", href: "/crm/prospeccao", ready: true },
      { label: "Oportunidades", href: "/crm/oportunidades", ready: true },
      { label: "Kanban", href: "/crm/kanban", ready: true },
      { label: "Propostas", href: "/crm/propostas", ready: false },
      { label: "Vendas", href: "/vendas", ready: true },
    ],
  },
  {
    label: "Atendimento",
    module: "atendimento",
    icon: MessageCircle,
    href: "/atendimento",
    items: [
      { label: "Conversas", href: "/atendimento", ready: true },
      { label: "Dashboard", href: "/atendimento/dashboard", ready: true },
    ],
  },
  {
    label: "Clientes",
    module: "clientes",
    icon: Building2,
    href: "/clientes",
    items: [
      { label: "Clientes", href: "/clientes", ready: true },
      { label: "Contatos", href: "/clientes/contatos", ready: true },
      { label: "Empresas", href: "/clientes/empresas", ready: true },
    ],
  },
  {
    label: "Instalações",
    module: "instalacoes",
    icon: Wrench,
    href: "/instalacoes/kanban",
    items: [
      { label: "Kanban", href: "/instalacoes/kanban", ready: true },
      { label: "Instalações", href: "/instalacoes", ready: true },
    ],
  },
  {
    label: "Financeiro",
    module: "financeiro",
    icon: Wallet,
    href: "/financeiro",
  },
  {
    label: "Catálogo",
    module: "catalogo",
    icon: Boxes,
    href: "/catalogo/produtos",
    items: [
      { label: "Produtos", href: "/catalogo/produtos", ready: false },
      { label: "Serviços", href: "/catalogo/servicos", ready: false },
      { label: "Planos", href: "/catalogo/planos", ready: false },
    ],
  },
  {
    label: "Relatórios",
    module: "relatorios_comercial",
    icon: LineChart,
    href: "/relatorios",
    items: [
      { label: "Atendimentos", href: "/relatorios/atendimentos", ready: true, module: "relatorios_atendimento" },
      { label: "Comercial", href: "/relatorios/comercial", ready: true, module: "relatorios_comercial" },
      { label: "Instalações", href: "/relatorios/instalacoes", ready: true, module: "relatorios_instalacoes" },
    ],
  },
  {
    label: "Agenda",
    module: "agenda",
    icon: CalendarDays,
    href: "/agenda",
  },
  {
    label: "Configurações",
    module: "configuracoes",
    icon: Settings,
    href: "/configuracoes/usuarios",
    items: [
      { label: "Usuários", href: "/configuracoes/usuarios", ready: true, activeHrefs: tabHrefs("usuarios") },
      { label: "Regiões", href: "/configuracoes/regioes", ready: true },
      { label: "Checklist de Instalação", href: "/configuracoes/checklist", ready: true },
      { label: "Kanbans", href: "/configuracoes/kanbans", ready: true },
      {
        label: "Atendimento",
        href: "/configuracoes/respostas-rapidas",
        ready: true,
        activeHrefs: tabHrefs("atendimento"),
      },
      { label: "Integrações", href: "/configuracoes/integracoes", ready: true },
      { label: "Backup", href: "/configuracoes/backup", ready: true, activeHrefs: tabHrefs("backup") },
      { label: "Licença", href: "/configuracoes/licenca", ready: true, supportOnly: true },
    ],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  VENDEDOR: "Vendedor",
  ATENDIMENTO: "Atendimento",
  INSTALADOR: "Instalador",
  FINANCEIRO: "Financeiro",
};

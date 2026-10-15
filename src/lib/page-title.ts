import type { Metadata } from "next";

import { NAV_GROUPS } from "@/components/layout/nav-config";

// Título da aba do navegador por seção do menu: "CRM INDEX - ATENDIMENTO".
// O nome vem do próprio menu lateral (NAV_GROUPS), então renomear um menu
// já muda a aba. O prefixo "CRM INDEX - " está no title.template do layout
// raiz (src/app/layout.tsx).
export function menuTitleMetadata(menuLabel: string): Metadata {
  const group = NAV_GROUPS.find((g) => g.label === menuLabel);
  return { title: (group?.label ?? menuLabel).toLocaleUpperCase("pt-BR") };
}

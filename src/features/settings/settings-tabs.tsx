"use client";

import { usePathname } from "next/navigation";

import { TabPills } from "@/components/tab-pills";
import { SETTINGS_TAB_GROUPS, type SettingsTabGroupKey } from "@/features/settings/tab-groups";

// Abas ao lado do título nas telas de Configurações que tratam do mesmo
// assunto (ex.: Usuários | Permissões). Cada aba continua sendo uma rota
// própria (ver tab-groups.ts).
export function SettingsTabs({ group }: { group: SettingsTabGroupKey }) {
  const pathname = usePathname();
  return (
    <TabPills tabs={SETTINGS_TAB_GROUPS[group].tabs.map((tab) => ({ ...tab, active: pathname === tab.href }))} />
  );
}

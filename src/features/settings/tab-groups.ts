// Telas de Configurações agrupadas em abas por assunto. O menu lateral
// mostra só uma entrada por grupo (o href da primeira aba) e a mantém
// destacada em qualquer aba do grupo — ver `activeHrefs` em nav-config.ts.
export type SettingsTab = { label: string; href: string };

export const SETTINGS_TAB_GROUPS = {
  usuarios: {
    label: "Usuários",
    tabs: [
      { label: "Usuários", href: "/configuracoes/usuarios" },
      { label: "Permissões", href: "/configuracoes/permissoes" },
    ],
  },
  atendimento: {
    label: "Atendimento",
    tabs: [
      { label: "Respostas rápidas", href: "/configuracoes/respostas-rapidas" },
      { label: "Mensagens automáticas", href: "/configuracoes/atendimento-automatico" },
    ],
  },
  backup: {
    label: "Backup",
    tabs: [
      { label: "Backup", href: "/configuracoes/backup" },
      { label: "Limpeza", href: "/configuracoes/limpeza" },
    ],
  },
} satisfies Record<string, { label: string; tabs: SettingsTab[] }>;

export type SettingsTabGroupKey = keyof typeof SETTINGS_TAB_GROUPS;

export function tabHrefs(group: SettingsTabGroupKey): string[] {
  return SETTINGS_TAB_GROUPS[group].tabs.map((tab) => tab.href);
}

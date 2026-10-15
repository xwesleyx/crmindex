import Link from "next/link";

import { cn } from "cn";

export type TabPill = { label: string; href: string; active: boolean };

// Abas em forma de "pílulas" ao lado do título da página (PageHeader `tabs`).
// Cada aba é um link — trocar de aba é navegar, então link direto e o
// "voltar" do navegador funcionam.
export function TabPills({ tabs, label = "Seções" }: { tabs: TabPill[]; label?: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 text-sm font-medium">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            tab.active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

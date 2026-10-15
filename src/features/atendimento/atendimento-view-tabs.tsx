"use client";

import { usePathname } from "next/navigation";

import { TabPills } from "@/components/tab-pills";

// Abas ao lado do título da Central: lista de conversas (padrão) ou Quadro
// (Kanban por atendente).
export function AtendimentoViewTabs() {
  const pathname = usePathname();
  const onBoard = pathname.startsWith("/atendimento/quadro");
  return (
    <TabPills
      label="Visualização"
      tabs={[
        { label: "Conversas", href: "/atendimento", active: !onBoard },
        { label: "Quadro", href: "/atendimento/quadro", active: onBoard },
      ]}
    />
  );
}

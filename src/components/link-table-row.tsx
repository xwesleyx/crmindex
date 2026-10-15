"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "cn";

// Elementos que já têm ação própria dentro da linha (menu "⋯", links,
// checkboxes...) — clicar neles não deve também abrir o detalhe.
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label, [role='menuitem'], [role='checkbox']";

function shouldIgnore(event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>): boolean {
  const target = event.target as Element;
  // Diálogos/menus abertos a partir da linha ficam num portal fora da
  // tabela, mas o React ainda propaga o clique até aqui — sem essa checagem,
  // clicar dentro do diálogo "Editar" navegaria pro detalhe.
  if (!event.currentTarget.contains(target)) return true;
  return target.closest(INTERACTIVE_SELECTOR) !== null;
}

// Linha de tabela que abre `href` ao ser clicada (mesmo destino do "Ver
// detalhes"). Ctrl/⌘+clique e o botão do meio abrem em nova aba, como um
// link normal; Enter abre pelo teclado.
export function LinkTableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function open(newTab: boolean) {
    if (newTab) window.open(href, "_blank", "noopener");
    else router.push(href);
  }

  return (
    <TableRow
      tabIndex={0}
      className={cn("cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none", className)}
      onMouseEnter={() => router.prefetch(href)}
      onClick={(event) => {
        if (shouldIgnore(event)) return;
        // Não abrir se a pessoa só estava selecionando texto da linha.
        if (window.getSelection()?.toString()) return;
        open(event.ctrlKey || event.metaKey);
      }}
      onAuxClick={(event) => {
        if (event.button !== 1 || shouldIgnore(event)) return;
        open(true);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || shouldIgnore(event) || event.target !== event.currentTarget) return;
        open(event.ctrlKey || event.metaKey);
      }}
    >
      {children}
    </TableRow>
  );
}

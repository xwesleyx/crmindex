"use client";

import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Barra de filtro compacta (seção 4 do escopo de refinamento): busca +
// botão "Filtros" (abre popover com os filtros secundários) + slot opcional
// de ordenação, tudo numa linha só. Nenhum filtro foi removido — só saiu do
// card sempre-expandido pra dentro do popover.
export function FilterBar({
  searchSlot,
  popoverSlot,
  activeCount = 0,
  sortSlot,
}: {
  searchSlot: ReactNode;
  popoverSlot: ReactNode;
  activeCount?: number;
  sortSlot?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
      <div className="min-w-48 flex-1">{searchSlot}</div>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-3.5" />
              Filtros
              {activeCount > 0 && (
                <Badge className="ml-0.5 h-4.5 min-w-4.5 justify-center px-1 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          }
        />
        <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
          <div className="flex flex-col gap-3">{popoverSlot}</div>
        </PopoverContent>
      </Popover>

      {sortSlot}
    </div>
  );
}

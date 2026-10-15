"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "cn";
import type { RegionListItem } from "@/features/regions/queries";

// Mesmo padrão de src/features/agenda/agenda-filters.tsx (chips toggle +
// "Todas" pré-selecionado, sincronizado num param de URL) — reusado em
// Kanban comercial, Kanban de instalação, Dashboard e Relatórios, um único
// componente pros quatro lugares (pedido: "já pense nos Kanban ter as
// opções de região em cima... mas pré setado sempre em todas").
export function RegionFilterChips({
  regions,
  basePath,
  paramName = "regions",
}: {
  regions: RegionListItem[];
  basePath: string;
  paramName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (regions.length === 0) return null;

  const activeIds = (searchParams.get(paramName) ?? "").split(",").filter(Boolean);
  const allSelected = activeIds.length === 0;

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  function toggleRegion(id: string) {
    const next = allSelected
      ? [id]
      : activeIds.includes(id)
        ? activeIds.filter((r) => r !== id)
        : [...activeIds, id];
    // Nunca colapsa de volta pra "Todas" só porque a seleção acabou cobrindo
    // todas as regiões existentes — com poucas regiões cadastradas (ex: só
    // "Cachoeiro"), isso fazia o clique voltar pra "Todas" na hora, sem
    // nunca conseguir isolar aquela região específica. Só "Todas" (botão
    // dedicado) ou esvaziar a seleção reseta o filtro.
    updateParams({ [paramName]: next.length === 0 ? null : next.join(",") });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Região:</span>
      <button
        type="button"
        onClick={() => updateParams({ [paramName]: null })}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs transition-colors",
          allSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
        )}
      >
        Todas
      </button>
      {regions.map((region) => (
        <button
          key={region.id}
          type="button"
          onClick={() => toggleRegion(region.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
            !allSelected && activeIds.includes(region.id)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
          <span className="font-semibold">{region.name}</span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { LeadOrigin, Priority } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SortSelect, type SortOption } from "@/components/sort-select";
import { ORIGIN_LABELS, OPPORTUNITY_STATUS_LABELS, PRIORITY_LABELS } from "@/features/opportunities/labels";
import type { AssignableUser } from "@/features/leads/types";

const ALL = "all";

// Kanban agrupa por etapa e não usa sort/dir (kanbanFiltersSchema não tem
// esses campos) — só a lista (/crm/oportunidades) recebe o controle "Ordenar".
const SORT_OPTIONS: SortOption[] = [
  { value: "updatedAt-desc", sort: "updatedAt", dir: "desc", label: "Atualizadas recentemente" },
  { value: "createdAt-desc", sort: "createdAt", dir: "desc", label: "Mais recentes" },
  { value: "estimatedValueCents-desc", sort: "estimatedValueCents", dir: "desc", label: "Maior valor" },
  { value: "estimatedValueCents-asc", sort: "estimatedValueCents", dir: "asc", label: "Menor valor" },
  { value: "expectedCloseAt-asc", sort: "expectedCloseAt", dir: "asc", label: "Previsão de fechamento" },
  { value: "title-asc", sort: "title", dir: "asc", label: "Título A-Z" },
];

export function OpportunitiesFilters({
  stages,
  assignableUsers,
  basePath,
  showSort = false,
}: {
  stages: { id: string; name: string }[];
  assignableUsers: AssignableUser[];
  basePath: string;
  showSort?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [minValue, setMinValue] = useState(searchParams.get("minValueCents") ?? "");
  const [maxValue, setMaxValue] = useState(searchParams.get("maxValueCents") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const updates: Record<string, string | null> = {};
      if (q !== (searchParams.get("q") ?? "")) updates.q = q || null;
      if (minValue !== (searchParams.get("minValueCents") ?? ""))
        updates.minValueCents = minValue ? String(Number(minValue) * 100) : null;
      if (maxValue !== (searchParams.get("maxValueCents") ?? ""))
        updates.maxValueCents = maxValue ? String(Number(maxValue) * 100) : null;
      if (Object.keys(updates).length > 0) updateParams(updates);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, minValue, maxValue]);

  const activeCount = [
    searchParams.get("stageId"),
    searchParams.get("status"),
    searchParams.get("priority"),
    searchParams.get("origin"),
    searchParams.get("ownerId"),
    searchParams.get("minValueCents"),
    searchParams.get("maxValueCents"),
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
  ].filter(Boolean).length;

  const sortValue = `${searchParams.get("sort") ?? "updatedAt"}-${searchParams.get("dir") ?? "desc"}`;

  return (
    <FilterBar
      activeCount={activeCount}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, empresa, contato ou telefone..."
            className="pl-8"
          />
        </div>
      }
      sortSlot={
        showSort && (
          <SortSelect
            value={sortValue}
            options={SORT_OPTIONS}
            onChange={(opt) => updateParams({ sort: opt.sort, dir: opt.dir })}
          />
        )
      }
      popoverSlot={
        <>
          <FilterSelect
            label="Etapa"
            value={searchParams.get("stageId") ?? ALL}
            onChange={(v) => updateParams({ stageId: v })}
            options={[{ value: ALL, label: "Todas" }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
          />

          <FilterSelect
            label="Status"
            value={searchParams.get("status") ?? ALL}
            onChange={(v) => updateParams({ status: v })}
            options={[
              { value: ALL, label: "Todos" },
              ...Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />

          <FilterSelect
            label="Prioridade"
            value={searchParams.get("priority") ?? ALL}
            onChange={(v) => updateParams({ priority: v })}
            options={[
              { value: ALL, label: "Todas" },
              ...Object.values(Priority).map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
            ]}
          />

          <FilterSelect
            label="Origem"
            value={searchParams.get("origin") ?? ALL}
            onChange={(v) => updateParams({ origin: v })}
            options={[
              { value: ALL, label: "Todas" },
              ...Object.values(LeadOrigin).map((o) => ({ value: o, label: ORIGIN_LABELS[o] })),
            ]}
          />

          <FilterSelect
            label="Responsável"
            value={searchParams.get("ownerId") ?? ALL}
            onChange={(v) => updateParams({ ownerId: v })}
            options={[
              { value: ALL, label: "Todos" },
              ...assignableUsers.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />

          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Valor mín. (R$)</Label>
              <Input
                type="number"
                min={0}
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Valor máx. (R$)</Label>
              <Input
                type="number"
                min={0}
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder="Sem limite"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Criada de</Label>
              <Input
                type="date"
                defaultValue={searchParams.get("dateFrom") ?? ""}
                onChange={(e) => updateParams({ dateFrom: e.target.value || null })}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">até</Label>
              <Input
                type="date"
                defaultValue={searchParams.get("dateTo") ?? ""}
                onChange={(e) => updateParams({ dateTo: e.target.value || null })}
              />
            </div>
          </div>
        </>
      }
    />
  );
}

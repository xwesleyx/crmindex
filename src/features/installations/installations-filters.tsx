"use client";

import { Priority } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Input } from "@/components/ui/input";
import { SortSelect, type SortOption } from "@/components/sort-select";
import { INSTALLATION_STATUS_LABELS } from "@/features/installations/labels";
import { PRIORITY_LABELS } from "@/features/leads/labels";
import type { AssignableUser } from "@/features/leads/types";

const ALL = "all";

// Kanban de instalação agrupa por etapa (mesmo padrão do comercial) — só a
// lista recebe o controle "Ordenar", daí `showSort`.
const SORT_OPTIONS: SortOption[] = [
  { value: "createdAt-desc", sort: "createdAt", dir: "desc", label: "Mais recentes" },
  { value: "dueAt-asc", sort: "dueAt", dir: "asc", label: "Prazo mais próximo" },
  { value: "scheduledAt-asc", sort: "scheduledAt", dir: "asc", label: "Agendamento mais próximo" },
];

export function InstallationsFilters({
  assignableUsers,
  stages,
  basePath,
  showSort = false,
}: {
  assignableUsers: AssignableUser[];
  stages: { id: string; name: string }[];
  basePath: string;
  showSort?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
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
      if (q !== (searchParams.get("q") ?? "")) updateParams({ q: q || null });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCount = [
    searchParams.get("stageId"),
    searchParams.get("status"),
    searchParams.get("priority"),
    searchParams.get("responsibleId"),
  ].filter(Boolean).length;

  const sortValue = `${searchParams.get("sort") ?? "createdAt"}-${searchParams.get("dir") ?? "desc"}`;

  return (
    <FilterBar
      activeCount={activeCount}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por empresa ou contato..."
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
          {stages.length > 0 && (
            <FilterSelect
              label="Etapa"
              value={searchParams.get("stageId") ?? ALL}
              onChange={(v) => updateParams({ stageId: v })}
              options={[{ value: ALL, label: "Todas" }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
            />
          )}

          <FilterSelect
            label="Status"
            value={searchParams.get("status") ?? ALL}
            onChange={(v) => updateParams({ status: v })}
            options={[
              { value: ALL, label: "Todos" },
              ...Object.entries(INSTALLATION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
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
            label="Responsável"
            value={searchParams.get("responsibleId") ?? ALL}
            onChange={(v) => updateParams({ responsibleId: v })}
            options={[
              { value: ALL, label: "Todos" },
              ...assignableUsers.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />
        </>
      }
    />
  );
}

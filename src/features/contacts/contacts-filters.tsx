"use client";

import { LeadOrigin } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FilterBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Input } from "@/components/ui/input";
import { SortSelect, type SortOption } from "@/components/sort-select";
import { ORIGIN_LABELS } from "@/features/contacts/labels";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";

const ALL = "all";

const SORT_OPTIONS: SortOption[] = [
  { value: "createdAt-desc", sort: "createdAt", dir: "desc", label: "Mais recentes" },
  { value: "createdAt-asc", sort: "createdAt", dir: "asc", label: "Mais antigos" },
  { value: "name-asc", sort: "name", dir: "asc", label: "Nome A-Z" },
  { value: "lastInteractionAt-desc", sort: "lastInteractionAt", dir: "desc", label: "Última interação" },
];

export function ContactsFilters({
  companyOptions,
  assignableUsers,
}: {
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
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
    router.push(`/clientes/contatos?${params.toString()}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) {
        updateParams({ q: q || null });
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCount = [
    searchParams.get("companyId"),
    searchParams.get("origin"),
    searchParams.get("responsibleId"),
    searchParams.get("includeArchived") === "true" ? "true" : null,
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
            placeholder="Buscar por nome, telefone, WhatsApp, e-mail ou empresa..."
            className="pl-8"
          />
        </div>
      }
      sortSlot={
        <SortSelect
          value={sortValue}
          options={SORT_OPTIONS}
          onChange={(opt) => updateParams({ sort: opt.sort, dir: opt.dir })}
        />
      }
      popoverSlot={
        <>
          <FilterSelect
            label="Empresa"
            value={searchParams.get("companyId") ?? ALL}
            onChange={(v) => updateParams({ companyId: v })}
            options={[
              { value: ALL, label: "Todas" },
              ...companyOptions.map((c) => ({ value: c.id, label: c.tradeName || c.legalName })),
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
            value={searchParams.get("responsibleId") ?? ALL}
            onChange={(v) => updateParams({ responsibleId: v })}
            options={[
              { value: ALL, label: "Todos" },
              ...assignableUsers.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={searchParams.get("includeArchived") === "true"}
              onCheckedChange={(checked) =>
                updateParams({ includeArchived: checked ? "true" : null })
              }
            />
            Mostrar arquivados
          </label>
        </>
      }
    />
  );
}

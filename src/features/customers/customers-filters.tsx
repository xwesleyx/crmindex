"use client";

import { CustomerStatus } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SortSelect, type SortOption } from "@/components/sort-select";
import { CUSTOMER_STATUS_LABELS } from "@/features/customers/labels";
import type { AssignableUser } from "@/features/leads/types";

const ALL = "all";

const SORT_OPTIONS: SortOption[] = [
  { value: "becameCustomerAt-desc", sort: "becameCustomerAt", dir: "desc", label: "Cliente desde (recente)" },
  { value: "becameCustomerAt-asc", sort: "becameCustomerAt", dir: "asc", label: "Cliente desde (antigo)" },
  { value: "createdAt-desc", sort: "createdAt", dir: "desc", label: "Criado recentemente" },
];

export function CustomersFilters({ assignableUsers }: { assignableUsers: AssignableUser[] }) {
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
    router.push(`/clientes?${params.toString()}`);
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
    searchParams.get("status"),
    searchParams.get("responsibleId"),
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
  ].filter(Boolean).length;

  const sortValue = `${searchParams.get("sort") ?? "becameCustomerAt"}-${searchParams.get("dir") ?? "desc"}`;

  return (
    <FilterBar
      activeCount={activeCount}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, empresa, CNPJ, telefone ou WhatsApp..."
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
            label="Status"
            value={searchParams.get("status") ?? ALL}
            onChange={(v) => updateParams({ status: v })}
            options={[
              { value: ALL, label: "Todos" },
              ...Object.values(CustomerStatus).map((s) => ({ value: s, label: CUSTOMER_STATUS_LABELS[s] })),
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

          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Cliente desde</Label>
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

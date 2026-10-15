"use client";

import { SaleStatus } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SortSelect, type SortOption } from "@/components/sort-select";
import { SALE_STATUS_LABELS } from "@/features/sales/labels";
import type { AssignableUser } from "@/features/leads/types";

const ALL = "all";

const SORT_OPTIONS: SortOption[] = [
  { value: "soldAt-desc", sort: "soldAt", dir: "desc", label: "Mais recentes" },
  { value: "soldAt-asc", sort: "soldAt", dir: "asc", label: "Mais antigas" },
  { value: "amountCents-desc", sort: "amountCents", dir: "desc", label: "Maior valor" },
  { value: "amountCents-asc", sort: "amountCents", dir: "asc", label: "Menor valor" },
];

export function SalesFilters({ assignableUsers }: { assignableUsers: AssignableUser[] }) {
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
    router.push(`/vendas?${params.toString()}`);
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
    searchParams.get("status"),
    searchParams.get("ownerId"),
    searchParams.get("minValueCents"),
    searchParams.get("maxValueCents"),
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
  ].filter(Boolean).length;

  const sortValue = `${searchParams.get("sort") ?? "soldAt"}-${searchParams.get("dir") ?? "desc"}`;

  return (
    <FilterBar
      activeCount={activeCount}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por oportunidade, empresa ou contato..."
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
              ...Object.values(SaleStatus).map((s) => ({ value: s, label: SALE_STATUS_LABELS[s] })),
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
              <Input type="number" min={0} value={minValue} onChange={(e) => setMinValue(e.target.value)} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Valor máx. (R$)</Label>
              <Input type="number" min={0} value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">De</Label>
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

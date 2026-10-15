"use client";

import { LeadOrigin } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FilterBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ORIGIN_LABELS, OPPORTUNITY_STATUS_LABELS } from "@/features/opportunities/labels";
import { searchReportCompanies, searchReportContacts } from "@/features/reports/actions";
import { EntitySearchFilter } from "@/features/reports/entity-search-filter";
import type { AssignableUser } from "@/features/leads/types";

const ALL = "all";

const STATUS_OPTIONS = [
  { value: ALL, label: "Todos" },
  { value: "OPEN", label: OPPORTUNITY_STATUS_LABELS.OPEN },
  { value: "WON", label: OPPORTUNITY_STATUS_LABELS.WON },
  { value: "LOST", label: OPPORTUNITY_STATUS_LABELS.LOST },
];

export function CommercialReportFilters({
  assignableUsers,
  initialContactLabel = null,
  initialCompanyLabel = null,
}: {
  assignableUsers: AssignableUser[];
  initialContactLabel?: string | null;
  initialCompanyLabel?: string | null;
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
    router.push(`/relatorios/comercial?${params.toString()}`);
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
    searchParams.get("contactId"),
    searchParams.get("companyId"),
    searchParams.get("origin"),
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
  ].filter(Boolean).length;

  return (
    <FilterBar
      activeCount={activeCount}
      searchSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, empresa ou contato..."
            className="pl-8"
          />
        </div>
      }
      popoverSlot={
        <>
          <FilterSelect
            label="Status"
            value={searchParams.get("status") ?? ALL}
            onChange={(v) => updateParams({ status: v })}
            options={STATUS_OPTIONS}
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

          <FilterSelect
            label="Origem"
            value={searchParams.get("origin") ?? ALL}
            onChange={(v) => updateParams({ origin: v })}
            options={[
              { value: ALL, label: "Todas" },
              ...Object.values(LeadOrigin).map((origin) => ({ value: origin, label: ORIGIN_LABELS[origin] })),
            ]}
          />

          <EntitySearchFilter
            label="Contato"
            placeholder="Nome ou telefone..."
            value={searchParams.get("contactId")}
            initialLabel={initialContactLabel}
            onChange={(item) => updateParams({ contactId: item?.id ?? null })}
            search={searchReportContacts}
          />

          <EntitySearchFilter
            label="Empresa"
            placeholder="Razão social, nome fantasia ou CNPJ..."
            value={searchParams.get("companyId")}
            initialLabel={initialCompanyLabel}
            onChange={(item) => updateParams({ companyId: item?.id ?? null })}
            search={searchReportCompanies}
          />

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Um dia específico</Label>
            <Input
              type="date"
              defaultValue={
                searchParams.get("dateFrom") &&
                searchParams.get("dateFrom") === searchParams.get("dateTo")
                  ? (searchParams.get("dateFrom") ?? "")
                  : ""
              }
              onChange={(e) => updateParams({ dateFrom: e.target.value || null, dateTo: e.target.value || null })}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Período de</Label>
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

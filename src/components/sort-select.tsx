import { ArrowDownUp } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SortOption = { value: string; sort: string; dir: "asc" | "desc"; label: string };

// Único combo "campo + direção" (ex.: "Mais recentes") em vez de dois
// selects separados — cabe na linha [Buscar][Filtros][Ordenar] sem quebrar
// layout, e o backend (filters.sort/filters.dir) já existia antes desta
// etapa; isso só liga uma UI que faltava.
export function SortSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SortOption[];
  onChange: (option: SortOption) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const option = options.find((o) => o.value === v);
        if (option) onChange(option);
      }}
    >
      <SelectTrigger size="sm" className="gap-1.5">
        <ArrowDownUp className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

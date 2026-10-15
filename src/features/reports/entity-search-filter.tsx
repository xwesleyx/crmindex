"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReportSearchItem } from "@/features/reports/actions";

// Busca "de um só" (seção "procurar por apenas um contato, empresa...") —
// mesmo padrão visual de src/features/atendimento/new-conversation-dialog.tsx
// (input + lista de resultados embaixo, vira um "chip" quando escolhido),
// só que genérico o bastante pra servir tanto Contato quanto Empresa nos 3
// relatórios.
export function EntitySearchFilter({
  label,
  placeholder,
  value,
  initialLabel,
  onChange,
  search,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  initialLabel: string | null;
  onChange: (item: ReportSearchItem | null) => void;
  search: (q: string) => Promise<ReportSearchItem[]>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReportSearchItem[]>([]);
  const [selected, setSelected] = useState<ReportSearchItem | null>(
    value && initialLabel ? { id: value, label: initialLabel } : null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Acompanha limpeza feita por fora (ex.: botão "Limpar filtros" da barra)
  // — ajuste de estado durante o render (padrão oficial do React pra
  // "adjusting state when a prop changes"), não dentro de um efeito.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!value) setSelected(null);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const found = await search(query);
      setResults(found);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
          <span className="min-w-0 truncate">{selected.label}</span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setResults([]);
              onChange(null);
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-8 pl-7 text-sm"
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 flex max-h-40 w-full flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setQuery("");
                    setResults([]);
                    onChange(item);
                  }}
                  className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {item.label}
                  {item.sublabel && <span className="text-muted-foreground"> · {item.sublabel}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

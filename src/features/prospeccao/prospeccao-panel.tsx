"use client";

import { useEffect, useRef, useState } from "react";

import { ProspeccaoResultsTable } from "@/features/prospeccao/prospeccao-results-table";
import { ProspeccaoSearchForm } from "@/features/prospeccao/prospeccao-search-form";
import { clearProspeccaoDraft, saveProspeccaoDraft } from "@/features/prospeccao/actions";
import type { ProspeccaoFilters } from "@/features/prospeccao/storage";
import type { ProspectResult } from "@/features/prospeccao/types";

// Salvo por usuário no servidor (ver getProspeccaoDraft/saveProspeccaoDraft)
// — não por navegador — pra abrir do celular e ver a mesma busca feita no
// computador. O estado inicial já vem pronto da página (Server Component),
// então não precisa de nenhum carregamento no mount.
export function ProspeccaoPanel({
  initialFilters,
  initialResults,
}: {
  initialFilters: ProspeccaoFilters;
  initialResults: ProspectResult[];
}) {
  const [results, setResults] = useState<ProspectResult[]>(initialResults);
  const [filters, setFilters] = useState<ProspeccaoFilters>(initialFilters);
  const isFirstRender = useRef(true);

  // Autosave com debounce — evita salvar a cada tecla digitada no CNAE ou a
  // cada clique de checkbox; só grava a versão final ~800ms depois da
  // última mudança. Pula a primeira renderização (o servidor já mandou
  // exatamente esse estado, salvar de novo seria só um round-trip à toa).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveProspeccaoDraft(filters, results);
    }, 800);
    return () => clearTimeout(timer);
  }, [filters, results]);

  function handleClear() {
    setResults([]);
    clearProspeccaoDraft();
  }

  return (
    <div className="flex flex-col gap-4">
      <ProspeccaoSearchForm filters={filters} onFiltersChange={setFilters} onResults={setResults} />
      <ProspeccaoResultsTable
        results={results}
        onRemove={(cnpjs) => setResults((prev) => prev.filter((r) => !cnpjs.includes(r.cnpj)))}
        onEnriched={(cnpj, patch) =>
          setResults((prev) => prev.map((r) => (r.cnpj === cnpj ? { ...r, ...patch } : r)))
        }
        onClear={handleClear}
      />
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "cn";
import type { ChangelogEntry } from "@/lib/changelog";
import { formatChangelogDate, versionAnchor } from "@/lib/changelog-format";

// Menu lateral do Histórico de versões: uma entrada por versão (âncora pra
// seção da direita), destacando a versão que está na tela enquanto rola, e
// um campo pra filtrar por número/título.
export function VersionsNav({ entries }: { entries: ChangelogEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(entries[0] ? versionAnchor(entries[0].version) : "");

  useEffect(() => {
    const sections = entries
      .map((entry) => document.getElementById(versionAnchor(entry.version)))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed.filter((item) => item.isIntersecting);
        if (visible.length > 0) {
          const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          setActiveId(top.target.id);
        }
      },
      // Conta como "ativa" a versão que está na faixa de cima da tela.
      { rootMargin: "-80px 0px -60% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.version.includes(q.replace(/^v/, "")) ||
        entry.title.toLowerCase().includes(q) ||
        entry.changes.some((change) => change.toLowerCase().includes(q))
    );
  }, [entries, query]);

  return (
    <nav className="flex flex-col gap-2 text-sm" aria-label="Versões">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar versão ou mudança..."
          className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <ol className="themed-scrollbar flex max-h-[calc(100vh-10rem)] flex-col gap-0.5 overflow-y-auto pr-1">
        {filtered.map((entry, index) => {
          const id = versionAnchor(entry.version);
          const active = id === activeId;
          return (
            <li key={entry.version}>
              <a
                href={`#${id}`}
                onClick={() => setActiveId(id)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-md border-l-2 px-2.5 py-1.5 transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold tabular-nums", active && "text-primary")}>
                    v{entry.version}
                  </span>
                  {index === 0 && !query && (
                    <span className="rounded-full bg-success/15 px-1.5 text-[10px] font-medium text-success">atual</span>
                  )}
                  <span className="ml-auto text-[10px] tabular-nums">{formatChangelogDate(entry.date)}</span>
                </span>
                <span className="line-clamp-2 text-xs leading-snug">{entry.title}</span>
              </a>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="px-2.5 py-3 text-xs text-muted-foreground">Nenhuma versão encontrada.</li>}
      </ol>
    </nav>
  );
}

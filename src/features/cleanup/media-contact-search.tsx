"use client";

import { Loader2, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/format";
import { searchMediaContacts, type MediaContactOption } from "@/features/cleanup/actions";

// "Mídias de um contato": digita nome ou telefone, escolhe o contato certo
// na lista e a galeria passa a mostrar só as mídias das conversas dele.
export function MediaContactSearch({
  selected,
  onSelect,
}: {
  selected: { id: string; name: string; phone: string | null } | null;
  onSelect: (contactId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaContactOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Busca com pequena espera enquanto digita.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await searchMediaContacts(q);
      if (!cancelled) {
        setResults(found);
        setLoading(false);
        setOpen(true);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex w-fit max-w-full items-center gap-2 rounded-full border border-primary bg-primary/10 py-1 pr-1 pl-3 text-sm">
        <UserRound className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">
          Mídias de <strong>{selected.name}</strong>
          {selected.phone && <span className="text-muted-foreground"> · {formatPhone(selected.phone)}</span>}
        </span>
        <button
          type="button"
          aria-label="Mostrar mídias de todos"
          title="Mostrar mídias de todos"
          onClick={() => onSelect(null)}
          className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-primary/20"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim().length < 2) {
            setResults([]);
            setOpen(false);
          }
        }}
        onFocus={() => q.length >= 2 && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            onSelect(results[0].id);
          }
        }}
        placeholder="Buscar mídias de um contato (nome ou telefone)..."
        className="pr-8 pl-8"
      />
      {loading && (
        <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && q.length >= 2 && !loading && (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {results.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">Nenhum contato encontrado.</li>
          ) : (
            results.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => onSelect(contact.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{contact.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[contact.phone ? formatPhone(contact.phone) : null, contact.companyName]
                        .filter(Boolean)
                        .join(" · ") || "Sem telefone"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      contact.mediaCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {contact.mediaCount} mídia{contact.mediaCount === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

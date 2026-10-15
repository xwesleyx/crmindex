"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";

import {
  MEDIA_KINDS,
  MEDIA_KIND_LABELS,
  type MediaKind,
} from "@/features/cleanup/kinds";
import { MediaContactSearch } from "@/features/cleanup/media-contact-search";

const AGE_OPTIONS = [
  { value: 0, label: "Qualquer data" },
  { value: 1, label: "+ de 1 mês" },
  { value: 3, label: "+ de 3 meses" },
  { value: 6, label: "+ de 6 meses" },
  { value: 12, label: "+ de 1 ano" },
];

const ORDER_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigas", label: "Mais antigas" },
  { value: "maiores", label: "Maiores" },
];

const pill = (active: boolean) =>
  cn(
    "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
  );

// Filtros da galeria — tudo na URL (dá pra voltar/compartilhar e a página
// calcula no servidor). Tipos: nenhum marcado = todos.
export function MediaFilters({
  kinds,
  months,
  order,
  contact,
}: {
  kinds: MediaKind[];
  months: number;
  order: string;
  contact: { id: string; name: string; phone: string | null } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleKind(kind: MediaKind) {
    const next = kinds.includes(kind)
      ? kinds.filter((value) => value !== kind)
      : [...kinds, kind];
    update({
      tipo:
        next.length > 0 && next.length < MEDIA_KINDS.length
          ? next.join(",")
          : null,
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <MediaContactSearch
        selected={contact}
        onSelect={(contactId) => update({ contato: contactId })}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={pill(kinds.length === 0)}
          onClick={() => update({ tipo: null })}
        >
          Todas
        </button>
        {MEDIA_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={pill(kinds.includes(kind))}
            onClick={() => toggleKind(kind)}
          >
            {MEDIA_KIND_LABELS[kind]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {AGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={pill(months === option.value)}
            onClick={() =>
              update({ meses: option.value ? String(option.value) : null })
            }
          >
            {option.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {ORDER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={pill(order === option.value)}
            onClick={() =>
              update({
                ordem: option.value === "recentes" ? null : option.value,
              })
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import { userColor } from "@/lib/user-color";
import { AGENDA_CATEGORIES, AGENDA_CATEGORY_LABELS, type AgendaCategory } from "@/features/agenda/types";
import { AGENDA_RANGE_DAYS } from "@/features/agenda/schema";

// "se o usuário terá que ver só a agenda que eu marcar" (pedido do usuário)
// — igual à ideia da lista de calendários do Google Agenda: cada categoria é
// um toggle independente, tudo guardado na URL (mesmo padrão já usado nos
// filtros de Atendimento/Leads/Oportunidades — dá pra favoritar/compartilhar
// o link já filtrado).
const ALL_PEOPLE = "all";

export function AgendaFilters({
  activeCategories,
  activeDays,
  showDays = true,
  people,
  activePerson,
}: {
  activeCategories: AgendaCategory[];
  activeDays: number;
  showDays?: boolean;
  // Filtro por pessoa: só vem preenchido pra quem vê a agenda de todos.
  people: { id: string; name: string }[] | null;
  activePerson: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    router.push(`/agenda?${params.toString()}`);
  }

  function toggleCategory(category: AgendaCategory) {
    const isAll = activeCategories.length === AGENDA_CATEGORIES.length;
    const next = isAll
      ? [category]
      : activeCategories.includes(category)
        ? activeCategories.filter((c) => c !== category)
        : [...activeCategories, category];
    const finalNext = next.length === 0 ? [...AGENDA_CATEGORIES] : next;
    updateParams({
      categories: finalNext.length === AGENDA_CATEGORIES.length ? null : finalNext.join(","),
    });
  }

  const allSelected = activeCategories.length === AGENDA_CATEGORIES.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => updateParams({ categories: null })}
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs transition-colors",
          allSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
        )}
      >
        Todas
      </button>
      {AGENDA_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => toggleCategory(category)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            !allSelected && activeCategories.includes(category)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {AGENDA_CATEGORY_LABELS[category]}
        </button>
      ))}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {people && (
          <Select
            value={activePerson ?? ALL_PEOPLE}
            onValueChange={(v) => updateParams({ pessoa: !v || v === ALL_PEOPLE ? null : v })}
          >
            <SelectTrigger size="sm" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PEOPLE}>Todas as pessoas</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: userColor(person.id) }} />
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showDays && (
          <Select value={String(activeDays)} onValueChange={(v) => updateParams({ days: v })}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENDA_RANGE_DAYS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  Próximos {days} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

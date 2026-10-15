"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "cn";
import {
  RECURRENCE_KIND_LABELS,
  RECURRENCE_KINDS,
  WEEKDAY_SHORT,
  parseRecurrence,
  serializeRecurrence,
  type RecurrenceKind,
} from "@/features/tasks/recurrence";

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

// "Repetir" do formulário de tarefa: tipo de repetição e, quando faz
// sentido, os dias — semanas (seg, qua, sex…) ou o dia do mês (todo dia 18).
// O valor é o texto de Task.recurrence (ver features/tasks/recurrence.ts).
export function RecurrencePicker({
  value,
  onChange,
  dueAt,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  // Prazo do formulário — usado como padrão do dia da semana/do mês.
  dueAt: string | Date | undefined | null;
}) {
  const rule = parseRecurrence(value);
  const base = dueAt ? new Date(dueAt) : new Date();
  const reference = Number.isNaN(base.getTime()) ? new Date() : base;

  function selectKind(kind: string) {
    if (kind === "none") return onChange(undefined);
    const next: RecurrenceKind = kind as RecurrenceKind;
    if (next === "WEEKLY") return onChange(serializeRecurrence({ kind: next, weekdays: [reference.getDay()] }) ?? undefined);
    if (next === "MONTHLY") return onChange(serializeRecurrence({ kind: next, monthDay: reference.getDate() }) ?? undefined);
    onChange(next);
  }

  function toggleWeekday(day: number) {
    const current = rule?.weekdays ?? [reference.getDay()];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b);
    if (next.length === 0) return; // pelo menos um dia
    onChange(serializeRecurrence({ kind: "WEEKLY", weekdays: next }) ?? undefined);
  }

  const weekdays = rule?.kind === "WEEKLY" ? (rule.weekdays ?? [reference.getDay()]) : [];
  const monthDay = rule?.kind === "MONTHLY" ? (rule.monthDay ?? reference.getDate()) : null;

  return (
    <div className="flex flex-col gap-2">
      <Select value={rule?.kind ?? "none"} onValueChange={(v) => selectKind(String(v ?? "none"))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Não repete</SelectItem>
          {RECURRENCE_KINDS.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {RECURRENCE_KIND_LABELS[kind]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {rule?.kind === "WEEKLY" && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Dias da semana">
          {WEEKDAY_SHORT.map((label, day) => {
            const active = weekdays.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWeekday(day)}
                className={cn(
                  "h-7 min-w-9 rounded-md border px-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {rule?.kind === "MONTHLY" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">No dia</span>
          <Select
            value={String(monthDay)}
            onValueChange={(v) => onChange(serializeRecurrence({ kind: "MONTHLY", monthDay: Number(v) }) ?? undefined)}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_MONTH.map((day) => (
                <SelectItem key={day} value={String(day)}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">de cada mês</span>
        </div>
      )}
    </div>
  );
}

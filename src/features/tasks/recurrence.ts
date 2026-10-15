// Repetição de tarefa, guardada em Task.recurrence como texto:
//   "DAILY"                 — todo dia
//   "WEEKLY:1,3,5"          — toda semana nos dias marcados (0=dom … 6=sáb)
//   "BIWEEKLY"              — a cada 15 dias
//   "MONTHLY:18"            — todo mês no dia 18 (meses mais curtos: último dia)
// "WEEKLY"/"MONTHLY" sem complemento (tarefas antigas) usam o dia da semana /
// do mês do próprio prazo. O horário vem sempre do prazo da tarefa.
//
// A tarefa no banco é a ocorrência "atual"; as próximas são calculadas aqui
// pra aparecerem na Agenda (occurrencesBetween) e, ao concluir, a próxima vira
// tarefa de verdade (nextOccurrence).

export const RECURRENCE_KINDS = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

export type RecurrenceRule = { kind: RecurrenceKind; weekdays?: number[]; monthDay?: number };

export const RECURRENCE_KIND_LABELS: Record<RecurrenceKind, string> = {
  DAILY: "Todo dia",
  WEEKLY: "Toda semana",
  BIWEEKLY: "A cada 15 dias",
  MONTHLY: "Todo mês",
};

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function parseRecurrence(value: string | null | undefined): RecurrenceRule | null {
  if (!value) return null;
  const [kind, extra] = value.split(":");
  if (!(RECURRENCE_KINDS as readonly string[]).includes(kind)) return null;
  const rule: RecurrenceRule = { kind: kind as RecurrenceKind };
  if (kind === "WEEKLY" && extra) {
    const days = [...new Set(extra.split(",").map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length > 0) rule.weekdays = days.sort((a, b) => a - b);
  }
  if (kind === "MONTHLY" && extra) {
    const day = Number(extra);
    if (Number.isInteger(day) && day >= 1 && day <= 31) rule.monthDay = day;
  }
  return rule;
}

export function serializeRecurrence(rule: RecurrenceRule | null): string | null {
  if (!rule) return null;
  if (rule.kind === "WEEKLY" && rule.weekdays?.length) return `WEEKLY:${rule.weekdays.join(",")}`;
  if (rule.kind === "MONTHLY" && rule.monthDay) return `MONTHLY:${rule.monthDay}`;
  return rule.kind;
}

export function isValidRecurrence(value: string): boolean {
  return parseRecurrence(value) !== null;
}

export function describeRecurrence(value: string | null | undefined): string | null {
  const rule = parseRecurrence(value);
  if (!rule) return null;
  if (rule.kind === "WEEKLY" && rule.weekdays?.length) {
    return `Toda semana: ${rule.weekdays.map((d) => WEEKDAY_SHORT[d].toLowerCase()).join(", ")}`;
  }
  if (rule.kind === "MONTHLY" && rule.monthDay) return `Todo mês no dia ${rule.monthDay}`;
  return RECURRENCE_KIND_LABELS[rule.kind];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Ocorrências estritamente depois de `anchor` (o prazo da tarefa atual),
// dentro de [from, to], em ordem. `limit` evita laço sem fim.
export function occurrencesBetween(
  value: string | null | undefined,
  anchor: Date,
  from: Date,
  to: Date,
  limit = 200
): Date[] {
  const rule = parseRecurrence(value);
  if (!rule || to < from) return [];
  const results: Date[] = [];
  const push = (date: Date) => {
    if (date > anchor && date >= from && date <= to) results.push(date);
  };

  if (rule.kind === "DAILY" || rule.kind === "BIWEEKLY" || (rule.kind === "WEEKLY" && !rule.weekdays)) {
    const step = rule.kind === "DAILY" ? 1 : rule.kind === "WEEKLY" ? 7 : 14;
    // Pula direto pra perto de `from` (série antiga não precisa iterar desde o início).
    const dayMs = 24 * 60 * 60_000;
    const skip = Math.max(0, Math.floor((from.getTime() - anchor.getTime()) / (step * dayMs)) - 1);
    for (let n = Math.max(1, skip); results.length < limit && n < skip + 2000; n++) {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() + n * step);
      if (date > to) break;
      push(date);
    }
    return results;
  }

  if (rule.kind === "WEEKLY") {
    const weekdays = new Set(rule.weekdays);
    const start = new Date(Math.max(anchor.getTime(), from.getTime() - 24 * 60 * 60_000));
    const cursor = new Date(anchor);
    cursor.setFullYear(start.getFullYear(), start.getMonth(), start.getDate());
    for (let i = 0; i < 2000 && results.length < limit; i++) {
      if (cursor > to) break;
      if (weekdays.has(cursor.getDay())) push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return results;
  }

  // MONTHLY
  const monthDay = rule.monthDay ?? anchor.getDate();
  const first = from > anchor ? from : anchor;
  let year = first.getFullYear();
  let month = first.getMonth() - 1;
  for (let i = 0; i < 400 && results.length < limit; i++) {
    const date = new Date(anchor);
    date.setFullYear(year, month, Math.min(monthDay, daysInMonth(year, month)));
    if (date > to) break;
    push(date);
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return results;
}

// Próxima ocorrência depois do prazo atual (vira tarefa ao concluir).
export function nextOccurrence(value: string | null | undefined, anchor: Date): Date | null {
  const horizon = new Date(anchor);
  horizon.setFullYear(horizon.getFullYear() + 1);
  return occurrencesBetween(value, anchor, anchor, horizon, 1)[0] ?? null;
}

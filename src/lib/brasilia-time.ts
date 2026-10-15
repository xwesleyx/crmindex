// "Agora" no horário de Brasília (America/Sao_Paulo) — usado pelas rotinas
// agendadas (Backup, Limpeza) pra decidir se já passou do horário escolhido,
// igual no servidor local e num servidor em UTC.
const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type BrasiliaNow = {
  // YYYY-MM-DD
  date: string;
  // minutos desde 00:00
  minutes: number;
  // 0 = domingo
  weekday: number;
};

export function brasiliaNow(now = new Date()): BrasiliaNow {
  const parts = Object.fromEntries(partsFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

// "HH:MM" -> minutos desde 00:00 (null se inválido).
export function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

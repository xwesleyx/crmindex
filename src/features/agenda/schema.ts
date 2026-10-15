import { z } from "zod";

import { AGENDA_CATEGORIES, type AgendaCategory } from "@/features/agenda/types";

export const AGENDA_RANGE_DAYS = [7, 14, 30, 90] as const;
export type AgendaRangeDays = (typeof AGENDA_RANGE_DAYS)[number];

// "Lista" (padrão, agrupada por dia), "Grade" (horários de um dia só,
// clicáveis) e "Calendário" (mês inteiro, clica no dia pra ver/criar) —
// seção "quero que tenha um grid... também quero que tenha uma outra
// visualização como se fosse um calendário mesmo grande".
// "Semana" = quadro com uma coluna por dia (segunda a domingo).
export const AGENDA_VIEWS = ["lista", "grade", "semana", "calendario"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

function isoDateOrNull(v: string | undefined): string | null {
  if (!v || Number.isNaN(new Date(v).getTime())) return null;
  return v;
}

export const agendaFiltersSchema = z.object({
  categories: z
    .string()
    .optional()
    .transform((v): AgendaCategory[] => {
      if (!v) return [...AGENDA_CATEGORIES];
      const parsed = v.split(",").filter((c): c is AgendaCategory => AGENDA_CATEGORIES.includes(c as AgendaCategory));
      return parsed.length > 0 ? parsed : [...AGENDA_CATEGORIES];
    }),
  days: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return AGENDA_RANGE_DAYS.includes(n as AgendaRangeDays) ? (n as AgendaRangeDays) : 30;
    }),
  // null = sem `view` na URL → a página usa a visão padrão do usuário
  // (estrela nas abas) ou a Lista.
  view: z
    .string()
    .optional()
    .transform((v): AgendaView | null => (AGENDA_VIEWS.includes(v as AgendaView) ? (v as AgendaView) : null)),
  // Dia escolhido no ícone de calendário da Lista (yyyy-MM-dd) — sem ele, a
  // Lista mostra os "próximos N dias".
  listDate: z.string().optional().transform(isoDateOrNull),
  // Qualquer dia da semana exibida na visão Semana (yyyy-MM-dd).
  weekDate: z.string().optional().transform(isoDateOrNull),
  // Filtro por responsável (só pra quem vê a agenda de todos).
  pessoa: z
    .string()
    .optional()
    .transform((v) => (v && /^[a-z0-9]+$/i.test(v) ? v : null)),
  // Dia exibido na Grade (yyyy-MM-dd) — null quando ausente/inválido, a
  // página então usa "hoje" como padrão.
  gridDate: z.string().optional().transform(isoDateOrNull),
  // Mês exibido no Calendário (yyyy-MM).
  calMonth: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null)),
  // Dia selecionado dentro do Calendário (yyyy-MM-dd).
  calDate: z.string().optional().transform(isoDateOrNull),
});

export type AgendaFilters = z.infer<typeof agendaFiltersSchema>;

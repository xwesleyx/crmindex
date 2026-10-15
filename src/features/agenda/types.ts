export type AgendaCategory = "atendimento" | "crm" | "instalacao" | "geral";

export const AGENDA_CATEGORIES: AgendaCategory[] = ["atendimento", "crm", "instalacao", "geral"];

export const AGENDA_CATEGORY_LABELS: Record<AgendaCategory, string> = {
  atendimento: "Atendimento",
  crm: "CRM",
  instalacao: "Instalação",
  // Tarefa avulsa, criada direto na Agenda (Grade/Calendário) — não tem
  // entidade dona (seção "a tarefa não precisa estar vinculada a um
  // atendimento").
  geral: "Geral",
};

// Um "compromisso" da agenda pode vir de fontes diferentes (Task genérica,
// Installation.scheduledAt, Lead.nextActionAt) — normalizado num formato
// único só pra exibição, cada um mantém seu link de volta pro registro real
// (a agenda não edita nada, só mostra e permite ir até a origem).
export type AgendaEvent = {
  id: string;
  category: AgendaCategory;
  title: string;
  subtitle: string | null;
  when: Date;
  responsibleName: string | null;
  // Pra cor por pessoa e filtro.
  responsibleId: string | null;
  href: string;
  done: boolean;
  source: "task" | "installation" | "lead";
  // Só preenchido pra eventos vindos de Task (usado pela seção "Pendentes" —
  // distingue "atrasado desde X" de "nunca teve prazo", já que `when` sempre
  // precisa de um valor mesmo quando a tarefa não tem dueAt).
  dueAt?: Date | null;
  // Só pra eventos de Task: id real (arrastar/concluir direto da Agenda),
  // duração (fim = when + duração) e repetição.
  taskId?: string;
  durationMinutes?: number | null;
  recurrence?: string | null;
  // Repetição futura calculada (não é uma tarefa própria no banco): aparece
  // no dia certo, mas não arrasta nem conclui — abre a tarefa da série.
  virtual?: boolean;
};

// Fim do compromisso (quando tem duração) — Grade/Semana mostram "14:00–15:30".
export function agendaEventEnd(event: AgendaEvent): Date | null {
  return event.durationMinutes ? new Date(event.when.getTime() + event.durationMinutes * 60_000) : null;
}

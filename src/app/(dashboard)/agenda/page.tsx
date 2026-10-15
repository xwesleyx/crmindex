import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { addDays, endOfDay, endOfMonth, endOfWeek, format, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { AgendaDayGrid } from "@/features/agenda/agenda-day-grid";
import { AgendaFilters } from "@/features/agenda/agenda-filters";
import { AgendaList } from "@/features/agenda/agenda-list";
import { AgendaListDateBar } from "@/features/agenda/agenda-list-date-bar";
import { AgendaMonthCalendar } from "@/features/agenda/agenda-month-calendar";
import { AgendaNewTaskButton } from "@/features/agenda/agenda-new-task-button";
import { AgendaPendingTasks } from "@/features/agenda/agenda-pending-tasks";
import { AgendaViewTabs } from "@/features/agenda/agenda-view-tabs";
import { AgendaWeekBoard } from "@/features/agenda/agenda-week-board";
import { canViewAllTasks, getAgendaEvents, getPendingTaskEvents } from "@/features/agenda/queries";
import { AGENDA_VIEWS, agendaFiltersSchema, type AgendaView } from "@/features/agenda/schema";
import { prisma } from "@/lib/prisma";
import { listAssignableUsers } from "@/features/leads/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "agenda", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso à Agenda."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = agendaFiltersSchema.parse(flatParams);

  // Sem `view` na URL, abre a visão marcada com estrela pela pessoa (ou Lista).
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { agendaDefaultView: true },
  });
  const defaultView = AGENDA_VIEWS.includes(me?.agendaDefaultView as AgendaView)
    ? (me!.agendaDefaultView as AgendaView)
    : null;
  const view: AgendaView = filters.view ?? defaultView ?? "lista";

  // Filtro por pessoa: só pra quem vê a agenda de todos (Admin/Gerente).
  const canFilterPeople = canViewAllTasks(session.user.role);
  const people = canFilterPeople
    ? await prisma.user.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : null;
  const person = canFilterPeople && filters.pessoa && people?.some((p) => p.id === filters.pessoa) ? filters.pessoa : null;

  const today = new Date();
  const gridDate = filters.gridDate ?? format(today, "yyyy-MM-dd");
  const calMonth = filters.calMonth ?? format(today, "yyyy-MM");
  const calDate = filters.calDate ?? format(today, "yyyy-MM-dd");
  const weekDate = filters.weekDate ?? format(today, "yyyy-MM-dd");

  // Cada visão precisa de um período diferente pra buscar eventos: a Lista
  // usa o filtro "próximos N dias", a Grade só o dia exibido, e o Calendário
  // o mês inteiro (incluindo os dias de borda das semanas anterior/seguinte
  // que aparecem no grid).
  let from: Date;
  let to: Date;
  if (view === "grade") {
    const day = startOfDay(parseISO(gridDate));
    from = day;
    to = endOfDay(day);
  } else if (view === "semana") {
    const weekStart = startOfWeek(parseISO(weekDate), { weekStartsOn: 1 });
    from = weekStart;
    to = endOfDay(addDays(weekStart, 6));
  } else if (view === "calendario") {
    const monthStart = startOfMonth(parseISO(`${calMonth}-01`));
    from = startOfWeek(monthStart, { weekStartsOn: 0 });
    to = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });
  } else if (filters.listDate) {
    // Lista com um dia escolhido no ícone de calendário: só aquele dia.
    from = startOfDay(parseISO(filters.listDate));
    to = endOfDay(from);
  } else {
    from = startOfDay(today);
    to = endOfDay(addDays(from, filters.days));
  }

  const [events, pendingEvents, assignableUsers] = await Promise.all([
    getAgendaEvents({ categories: filters.categories, from, to, responsibleId: person }, session.user),
    view === "lista" ? getPendingTaskEvents(filters.categories, session.user, person) : Promise.resolve([]),
    listAssignableUsers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Agenda"
        description="Tudo que tem horário e responsável — atendimento, CRM, instalação e tarefas gerais, num só lugar."
        action={<AgendaNewTaskButton assignableUsers={assignableUsers} currentUserId={session.user.id} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AgendaViewTabs view={view} defaultView={defaultView} />
        <AgendaFilters
          activeCategories={filters.categories}
          activeDays={filters.days}
          showDays={view === "lista" && !filters.listDate}
          people={people}
          activePerson={person}
        />
      </div>

      {view === "lista" && (
        <>
          <AgendaListDateBar listDate={filters.listDate} days={filters.days} />
          <AgendaPendingTasks events={pendingEvents} assignableUsers={assignableUsers} />
          <AgendaList events={events} now={new Date().getTime()} assignableUsers={assignableUsers} />
        </>
      )}
      {view === "grade" && (
        <AgendaDayGrid
          date={gridDate}
          events={events}
          assignableUsers={assignableUsers}
          currentUserId={session.user.id}
        />
      )}
      {view === "semana" && (
        <AgendaWeekBoard
          weekDate={weekDate}
          events={events}
          assignableUsers={assignableUsers}
          currentUserId={session.user.id}
        />
      )}
      {view === "calendario" && (
        <AgendaMonthCalendar
          month={calMonth}
          selectedDate={calDate}
          events={events}
          assignableUsers={assignableUsers}
          currentUserId={session.user.id}
        />
      )}
    </div>
  );
}

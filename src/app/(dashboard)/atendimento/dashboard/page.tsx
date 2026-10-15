import { redirect } from "next/navigation";
import { CheckCircle2, Clock, MessageCirclePlus, ShieldAlert, Timer, UserX } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatDurationMinutes } from "@/lib/format";
import { getAtendimentoDashboard, getTopAttendants } from "@/features/atendimento/queries";
import { AtendimentoHourlyChart } from "@/features/atendimento/dashboard-charts";
import { AtendimentoLeaderboard } from "@/features/atendimento/dashboard-leaderboard";
import { AtendimentoTopAttendants } from "@/features/atendimento/dashboard-top-attendants";
import { AtendimentoDashboardTile } from "@/features/atendimento/dashboard-tile";
import { AtendimentoDashboardClock } from "@/features/atendimento/dashboard-live-clock";
import { AtendimentoDashboardAutoRefresh } from "@/features/atendimento/dashboard-auto-refresh";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

// Painel de TV da Central de Atendimento — substitui o antigo item
// "Tickets" (placeholder "Em breve" que nunca teve backend). Pensado pra
// ficar aberto numa tela do escritório: números grandes, ranking de quem
// mais atendeu e atualização automática, sem precisar de ninguém mexendo.
export default async function AtendimentoDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "atendimento", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso à Central de Atendimento."
      />
    );
  }

  const [dashboard, topAttendants] = await Promise.all([
    getAtendimentoDashboard(),
    getTopAttendants(5),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <AtendimentoDashboardAutoRefresh />

      <PageHeader
        title="Painel de Atendimento"
        description="Visão do dia da equipe — atualiza sozinho a cada minuto"
        action={<AtendimentoDashboardClock />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <AtendimentoDashboardTile
          label="Atendimentos concluídos hoje"
          value={dashboard.closedTodayCount}
          icon={CheckCircle2}
          tone="success"
        />
        <AtendimentoDashboardTile
          label="Novas conversas hoje"
          value={dashboard.openedToday}
          icon={MessageCirclePlus}
          tone="blue"
        />
        <AtendimentoDashboardTile
          label="Em atendimento agora"
          value={dashboard.activeNow}
          icon={Clock}
          tone="primary"
        />
        <AtendimentoDashboardTile
          label="Aguardando atendimento"
          value={dashboard.unassignedNow}
          icon={UserX}
          tone="warning"
        />
        <AtendimentoDashboardTile
          label="Tempo médio de atendimento"
          value={formatDurationMinutes(dashboard.avgMinutes)}
          icon={Timer}
          tone="purple"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Atendimentos concluídos por hora</CardTitle>
            <CardDescription>Hoje, das 7h às 20h</CardDescription>
          </CardHeader>
          <CardContent>
            <AtendimentoHourlyChart data={dashboard.hourly} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quem mais atendeu hoje</CardTitle>
            <CardDescription>Ranking por atendimentos concluídos</CardDescription>
          </CardHeader>
          <CardContent>
            <AtendimentoLeaderboard entries={dashboard.leaderboard} />
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Top 5 atendentes</CardTitle>
          <CardDescription>Ranking geral por atendimentos concluídos — mês atual e total</CardDescription>
        </CardHeader>
        <CardContent>
          <AtendimentoTopAttendants entries={topAttendants} />
        </CardContent>
      </Card>
    </div>
  );
}

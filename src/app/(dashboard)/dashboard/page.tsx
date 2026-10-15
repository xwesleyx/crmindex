import { DollarSign, HandCoins, LineChart, ThumbsUp, UserPlus } from "lucide-react";

import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { formatMoneyCents } from "@/lib/money";
import {
  getCommercialValueByStatus,
  getDashboardKpis,
  getPipelineByStage,
  getSalesEvolution,
  getWonLostSummary,
} from "@/features/dashboard/queries";
import {
  CommercialValueChart,
  PipelineByStageChart,
  SalesEvolutionChart,
  WonLostChart,
} from "@/features/dashboard/charts";
import { RegionFilterChips } from "@/features/regions/region-filter-chips";
import { listRegions } from "@/features/regions/queries";
import { parseRegionIds } from "@/features/regions/schema";
import { auth } from "@/lib/auth";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";
import { ROLE_LABELS } from "@/components/layout/nav-config";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  const name = session?.user?.name ?? "";
  const role = session?.user?.role;
  const user = session?.user;

  const flatParams = flattenSearchParams(await searchParams);
  const regionIds = parseRegionIds(flatParams.regions);
  const regions = await listRegions();

  const [kpis, salesEvolution, pipelineByStage, wonLost, commercialValue] = user
    ? await Promise.all([
        getDashboardKpis(user, regionIds),
        getSalesEvolution(user, regionIds),
        getPipelineByStage(user, regionIds),
        getWonLostSummary(user, regionIds),
        getCommercialValueByStatus(user, regionIds),
      ])
    : [null, [], [], [], []];

  // Tiras secundárias (Perdidas, Clientes ativos, Instalações) não competem
  // por atenção com os 5 KPIs principais — por isso viram uma faixa
  // compacta de rótulo+valor em vez de mais MetricCards (seção 7/12 do
  // refinamento: nem tudo precisa de um card próprio).
  const secondaryStats: { label: string; value: string | number | undefined; alert?: boolean }[] = [
    { label: "Perdidas", value: kpis?.lostCount },
    { label: "Clientes ativos", value: kpis?.activeCustomers },
    { label: "MRR", value: kpis ? formatMoneyCents(kpis.mrrCents) : undefined },
    { label: "Instalações pendentes", value: kpis?.installationsPending },
    {
      label: "Implantações atrasadas",
      value: kpis?.installationsOverdue,
      alert: !!kpis && kpis.installationsOverdue > 0,
    },
    { label: "Instalações concluídas", value: kpis?.installationsCompleted },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Olá, ${name.split(" ")[0]}`}
        description={`${role ? ROLE_LABELS[role] : ""} · visão geral do funil comercial`}
      />

      <RegionFilterChips regions={regions} basePath="/dashboard" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Leads novos" icon={UserPlus} value={kpis?.newLeads} tone="blue" />
        <MetricCard
          label="Oportunidades abertas"
          icon={LineChart}
          value={kpis?.openOpportunities}
          tone="primary"
        />
        <MetricCard
          label="Pipeline"
          icon={HandCoins}
          value={kpis ? formatMoneyCents(kpis.pipelineCents) : undefined}
          tone="amber"
        />
        <MetricCard
          label="Oportunidades ganhas"
          icon={ThumbsUp}
          value={kpis?.wonCount}
          tone="success"
        />
        <MetricCard
          label="Vendido"
          icon={DollarSign}
          value={kpis ? formatMoneyCents(kpis.salesAmountCents) : undefined}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-stretch divide-x divide-border rounded-lg border border-border bg-card">
        {secondaryStats.map((stat) => (
          <div key={stat.label} className="flex min-w-32 flex-1 items-center gap-2 px-4 py-2.5">
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                stat.alert && "text-destructive"
              )}
            >
              {stat.value ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Evolução de vendas</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesEvolutionChart data={salesEvolution} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Pipeline por etapa</CardTitle>
            <CardDescription>Oportunidades em aberto</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineByStageChart data={pipelineByStage} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Ganhas x perdidas</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <WonLostChart data={wonLost} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Valor comercial por status</CardTitle>
            <CardDescription>Aberto, ganho e perdido</CardDescription>
          </CardHeader>
          <CardContent>
            <CommercialValueChart data={commercialValue} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Ciclo comercial completo com dados reais: leads, contatos, empresas, oportunidades, Kanban,
        venda ganha → cliente → instalação e checklist. Atendimento, WhatsApp e financeiro chegam em
        próximas fases.
      </p>
    </div>
  );
}

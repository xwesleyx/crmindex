"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoneyCents, formatMoneyCompact } from "@/lib/money";
import type {
  getCommercialValueByStatus,
  getPipelineByStage,
  getSalesEvolution,
  getWonLostSummary,
} from "@/features/dashboard/queries";

const STAGE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const AXIS_STYLE = { fontSize: 12, fill: "var(--color-muted-foreground)" };

export const CHART_HEIGHT = 208;

// Estado vazio de gráfico: só texto, sem ícone nem card aninhado dentro do
// card do gráfico ("caixa dentro de caixa" — seção 25 do refinamento). Ocupa
// a mesma altura do gráfico com dado pra não "pular" quando os dados chegam.
function ChartEmptyState({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 px-6 text-center"
      style={{ height: CHART_HEIGHT }}
    >
      <p className="text-sm font-medium text-foreground">Sem dados ainda</p>
      <p className="max-w-[26rem] text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: { value?: number; name?: string; color?: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5" style={{ color: entry.color }}>
          {entry.name ? `${entry.name}: ` : ""}
          {formatMoneyCents(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function SalesEvolutionChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getSalesEvolution>>;
}) {
  const hasData = data.some((d) => d.totalCents > 0);
  if (!hasData) {
    return <ChartEmptyState label="Ainda não há vendas confirmadas nos últimos 6 meses." />;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => formatMoneyCompact(v)}
          width={64}
        />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="totalCents" name="Vendido" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PipelineByStageChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getPipelineByStage>>;
}) {
  const hasData = data.some((d) => d.totalCents > 0);
  if (!hasData) {
    return <ChartEmptyState label="Nenhuma oportunidade em aberto no funil ainda." />;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="stage" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => formatMoneyCompact(v)}
          width={64}
        />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="totalCents" name="Valor" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.stage} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WonLostChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getWonLostSummary>>;
}) {
  const hasData = data.some((d) => d.won > 0 || d.lost > 0);
  if (!hasData) {
    return <ChartEmptyState label="Nenhuma oportunidade ganha ou perdida nos últimos 6 meses." />;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS_STYLE} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            borderColor: "var(--color-border)",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="won" name="Ganhas" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="lost" name="Perdidas" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLOR: Record<string, string> = {
  "Em aberto": "var(--color-primary)",
  Ganha: "var(--color-success)",
  Perdida: "var(--color-destructive)",
};

export function CommercialValueChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getCommercialValueByStatus>>;
}) {
  const hasData = data.some((d) => d.totalCents > 0);
  if (!hasData) {
    return <ChartEmptyState label="Nenhum valor comercial registrado ainda." />;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--color-border)" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => formatMoneyCompact(v)}
        />
        <YAxis type="category" dataKey="status" tickLine={false} axisLine={false} tick={AXIS_STYLE} width={72} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="totalCents" name="Valor" radius={[0, 4, 4, 0]}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? "var(--color-primary)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

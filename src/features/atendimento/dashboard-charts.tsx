"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { getAtendimentoDashboard } from "@/features/atendimento/queries";

const AXIS_STYLE = { fontSize: 12, fill: "var(--color-muted-foreground)" };
const CHART_HEIGHT = 240;

function HourTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: { value?: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{label}h</p>
      <p className="text-muted-foreground">
        {payload[0].value} {payload[0].value === 1 ? "atendimento" : "atendimentos"}
      </p>
    </div>
  );
}

export function AtendimentoHourlyChart({
  data,
}: {
  data: Awaited<ReturnType<typeof getAtendimentoDashboard>>["hourly"];
}) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-center" style={{ height: CHART_HEIGHT }}>
        <p className="text-sm font-medium text-foreground">Nenhum atendimento encerrado ainda hoje</p>
        <p className="max-w-[24rem] text-xs text-muted-foreground">
          O gráfico aparece assim que o primeiro atendimento do dia for encerrado.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tick={AXIS_STYLE}
          tickFormatter={(v: number) => `${v}h`}
        />
        <YAxis tickLine={false} axisLine={false} tick={AXIS_STYLE} allowDecimals={false} width={28} />
        <Tooltip content={<HourTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="count" name="Atendimentos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

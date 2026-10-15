import Link from "next/link";

import { MoneyDisplay } from "@/components/money-display";
import { StatusBadge } from "@/components/status-badge";
import { TemperatureBadge } from "@/components/temperature-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { OPPORTUNITY_STATUS_LABELS, OPPORTUNITY_STATUS_TONE } from "@/features/opportunities/labels";
import type { OpportunityListItem } from "@/features/opportunities/types";

export function CommercialReportTable({ opportunities }: { opportunities: OpportunityListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Empresa/Contato</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Temperatura</TableHead>
            <TableHead>Criada em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opportunity) => (
            <TableRow key={opportunity.id}>
              <TableCell>
                <Link href={`/crm/oportunidades/${opportunity.id}`} className="text-sm font-medium hover:underline">
                  {opportunity.title}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {opportunity.company
                  ? opportunity.company.tradeName || opportunity.company.legalName
                  : (opportunity.contact?.name ?? "—")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {opportunity.owner?.name ?? "Sem responsável"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{opportunity.stage.name}</TableCell>
              <TableCell>
                <MoneyDisplay cents={opportunity.estimatedValueCents} size="sm" />
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={OPPORTUNITY_STATUS_LABELS[opportunity.status]}
                  tone={OPPORTUNITY_STATUS_TONE[opportunity.status]}
                  solid={opportunity.status === "WON"}
                />
              </TableCell>
              <TableCell>
                {opportunity.temperature ? <TemperatureBadge temperature={opportunity.temperature} /> : "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(opportunity.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

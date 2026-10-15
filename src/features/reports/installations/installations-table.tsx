import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { checklistProgress, type InstallationListItem } from "@/features/installations/types";
import { INSTALLATION_STATUS_LABELS, INSTALLATION_STATUS_TONE } from "@/features/installations/labels";

export function InstallationsReportTable({ installations }: { installations: InstallationListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Checklist</TableHead>
            <TableHead>Agendada</TableHead>
            <TableHead>Concluída</TableHead>
            <TableHead>Criada em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installations.map((installation) => {
            const progress = checklistProgress(installation.checklistItems);
            return (
              <TableRow key={installation.id}>
                <TableCell>
                  <Link href={`/instalacoes/${installation.id}`} className="text-sm font-medium hover:underline">
                    {getCustomerDisplayName(installation.customer)}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {installation.responsible?.name ?? "Sem responsável"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{installation.stage.name}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={INSTALLATION_STATUS_LABELS[installation.status]}
                    tone={INSTALLATION_STATUS_TONE[installation.status]}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {progress.done}/{progress.total} ({progress.percent}%)
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {installation.scheduledAt ? formatDate(installation.scheduledAt) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {installation.completedAt ? formatDate(installation.completedAt) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(installation.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

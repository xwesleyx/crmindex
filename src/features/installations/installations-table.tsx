import Link from "next/link";
import type { UserRole } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { INSTALLATION_STATUS_LABELS, INSTALLATION_STATUS_TONE } from "@/features/installations/labels";
import { InstallationFormDialog } from "@/features/installations/installation-form-dialog";
import { canEditInstallation } from "@/features/installations/permissions";
import {
  checklistProgress,
  isInstallationOverdue,
  type InstallationListItem,
} from "@/features/installations/types";
import { cn } from "cn";
import type { AssignableUser } from "@/features/leads/types";
import { Pencil } from "lucide-react";

export function InstallationsTable({
  installations,
  assignableUsers,
  currentUser,
}: {
  installations: InstallationListItem[];
  assignableUsers: AssignableUser[];
  currentUser: { id: string; role: UserRole };
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Checklist</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installations.map((installation) => {
            const progress = checklistProgress(installation.checklistItems);
            const canEdit = canEditInstallation(currentUser.role, currentUser.id, installation);
            const overdue = isInstallationOverdue(installation);
            return (
              <TableRow key={installation.id}>
                <TableCell>
                  <Link
                    href={`/instalacoes/${installation.id}`}
                    className="text-sm font-medium hover:text-primary hover:underline"
                  >
                    {getCustomerDisplayName(installation.customer)}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {installation.stage.name}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={INSTALLATION_STATUS_LABELS[installation.status]}
                    tone={INSTALLATION_STATUS_TONE[installation.status]}
                  />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={installation.priority} />
                </TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {formatMoneyCents(installation.sale.amountCents)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {progress.done}/{progress.total} ({progress.percent}%)
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {installation.responsible?.name ?? "Sem responsável"}
                </TableCell>
                <TableCell
                  className={cn("text-sm", overdue ? "font-medium text-destructive" : "text-muted-foreground")}
                >
                  {installation.dueAt ? formatDateTime(installation.dueAt) : "—"}
                  {overdue && " · atrasada"}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <InstallationFormDialog
                      installation={installation}
                      assignableUsers={assignableUsers}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

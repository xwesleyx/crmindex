import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { TemperatureBadge } from "@/components/temperature-badge";
import { LEAD_ORIGIN_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONE } from "@/features/leads/labels";
import { LeadRowActions } from "@/features/leads/lead-row-actions";
import type { AssignableUser, LeadListItem } from "@/features/leads/types";
import { canEditLead } from "@/features/leads/permissions";
import type { UserRole } from "@prisma/client";

export function LeadsTable({
  leads,
  assignableUsers,
  stages,
  currentUser,
  atendimentoAssignableUsers,
}: {
  leads: LeadListItem[];
  assignableUsers: AssignableUser[];
  stages: { id: string; name: string }[];
  currentUser: { id: string; role: UserRole };
  atendimentoAssignableUsers: AssignableUser[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Temperatura</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Última interação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className={lead.deletedAt ? "opacity-60" : undefined}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{lead.name}</span>
                  {lead.companyName && (
                    <span className="text-xs text-muted-foreground">{lead.companyName}</span>
                  )}
                  {lead.deletedAt && (
                    <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                      Arquivado
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{lead.phone}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {LEAD_ORIGIN_LABELS[lead.origin]}
              </TableCell>
              <TableCell>
                <StatusBadge label={LEAD_STATUS_LABELS[lead.status]} tone={LEAD_STATUS_TONE[lead.status]} />
              </TableCell>
              <TableCell>
                {lead.temperature ? <TemperatureBadge temperature={lead.temperature} /> : "—"}
              </TableCell>
              <TableCell>
                <PriorityBadge priority={lead.priority} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {lead.responsible?.name ?? "Sem responsável"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDateTime(lead.lastInteractionAt)}
              </TableCell>
              <TableCell className="text-right">
                <LeadRowActions
                  lead={lead}
                  assignableUsers={assignableUsers}
                  stages={stages}
                  canEdit={canEditLead(currentUser.role, currentUser.id, lead)}
                  atendimentoAssignableUsers={atendimentoAssignableUsers}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

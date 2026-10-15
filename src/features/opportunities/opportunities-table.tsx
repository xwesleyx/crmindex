import type { UserRole } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import {
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_TONE,
} from "@/features/opportunities/labels";
import { OpportunityRowActions } from "@/features/opportunities/opportunity-row-actions";
import { canEditOpportunity } from "@/features/opportunities/permissions";
import type { OpportunityListItem } from "@/features/opportunities/types";
import type { AssignableUser } from "@/features/leads/types";
import type { CompanyOption } from "@/features/companies/types";
import type { ContactOption } from "@/features/contacts/types";

export function OpportunitiesTable({
  opportunities,
  stages,
  contactOptions,
  companyOptions,
  assignableUsers,
  currentUser,
}: {
  opportunities: OpportunityListItem[];
  stages: { id: string; name: string }[];
  contactOptions: ContactOption[];
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  currentUser: { id: string; role: UserRole };
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Oportunidade</TableHead>
            <TableHead>Empresa / Contato</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Previsão</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opp) => (
            <TableRow key={opp.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{opp.title}</span>
                  <span className="text-xs text-muted-foreground">
                    Atualizado {formatDateTime(opp.updatedAt)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <div className="flex flex-col">
                  <span>{opp.company ? opp.company.tradeName || opp.company.legalName : "—"}</span>
                  {opp.contact && <span className="text-xs">{opp.contact.name}</span>}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{opp.stage.name}</TableCell>
              <TableCell>
                <StatusBadge
                  label={OPPORTUNITY_STATUS_LABELS[opp.status]}
                  tone={OPPORTUNITY_STATUS_TONE[opp.status]}
                  solid={opp.status === "WON"}
                />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={opp.priority} />
              </TableCell>
              <TableCell className="text-right text-sm font-semibold tabular-nums">
                {formatMoneyCents(opp.estimatedValueCents)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {opp.owner?.name ?? "Sem responsável"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {opp.expectedCloseAt ? formatDate(opp.expectedCloseAt) : "—"}
              </TableCell>
              <TableCell className="text-right">
                <OpportunityRowActions
                  opportunity={opp}
                  stages={stages}
                  contactOptions={contactOptions}
                  companyOptions={companyOptions}
                  assignableUsers={assignableUsers}
                  canEdit={canEditOpportunity(currentUser.role, currentUser.id, opp)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

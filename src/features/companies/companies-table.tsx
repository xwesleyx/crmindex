import type { UserRole } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkTableRow } from "@/components/link-table-row";
import { formatCNPJ, formatPhone } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { ACTIVE_STATUS_LABEL, ACTIVE_STATUS_TONE } from "@/features/companies/labels";
import { CompanyRowActions } from "@/features/companies/company-row-actions";
import { CompanyCustomerStatus } from "@/features/companies/company-customer-status";
import { canEditCompany } from "@/features/companies/permissions";
import type { CompanyListItem } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";

export function CompaniesTable({
  companies,
  assignableUsers,
  regions,
  currentUser,
}: {
  companies: CompanyListItem[];
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
  currentUser: { id: string; role: UserRole };
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Região</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <LinkTableRow
              key={company.id}
              href={`/clientes/empresas/${company.id}`}
              className={company.deletedAt ? "opacity-60" : undefined}
            >
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {company.tradeName || company.legalName}
                  </span>
                  {company.tradeName && (
                    <span className="text-xs text-muted-foreground">{company.legalName}</span>
                  )}
                  {company.deletedAt && (
                    <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                      Arquivada
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatCNPJ(company.cnpj)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatPhone(company.phone)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  label={ACTIVE_STATUS_LABEL[String(company.isActive) as "true" | "false"]}
                  tone={ACTIVE_STATUS_TONE[String(company.isActive) as "true" | "false"]}
                />
              </TableCell>
              <TableCell>
                {!company.deletedAt || company.customer ? (
                  <CompanyCustomerStatus
                    companyId={company.id}
                    companyName={company.tradeName || company.legalName}
                    customer={company.customer}
                    canConvert={canEditCompany(currentUser.role, currentUser.id, company)}
                    size="xs"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {company.responsible?.name ?? "Sem responsável"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {company.region ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: company.region.color }}
                    />
                    {company.region.name}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right">
                <CompanyRowActions
                  company={company}
                  assignableUsers={assignableUsers}
                  regions={regions}
                  canEdit={canEditCompany(currentUser.role, currentUser.id, company)}
                />
              </TableCell>
            </LinkTableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

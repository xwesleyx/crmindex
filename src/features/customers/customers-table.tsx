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
import { LinkTableRow } from "@/components/link-table-row";
import { formatDate, formatPhone } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_TONE } from "@/features/customers/labels";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { canEditCustomer } from "@/features/customers/permissions";
import { getCustomerDisplayName } from "@/features/customers/utils";
import type { CustomerListItem } from "@/features/customers/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";
import { Pencil } from "lucide-react";

export function CustomersTable({
  customers,
  assignableUsers,
  regions,
  currentUser,
}: {
  customers: CustomerListItem[];
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
  currentUser: { id: string; role: UserRole };
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Cliente desde</TableHead>
            <TableHead>Região</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => {
            const canEdit = canEditCustomer(currentUser.role, currentUser.id, customer);
            const region = customer.region ?? customer.company?.region ?? null;
            return (
              <LinkTableRow key={customer.id} href={`/clientes/${customer.id}`}>
                <TableCell>
                  <Link
                    href={`/clientes/${customer.id}`}
                    className="text-sm font-medium hover:text-primary hover:underline"
                  >
                    {getCustomerDisplayName(customer)}
                  </Link>
                  {customer.company && (
                    <div className="text-xs text-muted-foreground">
                      {formatPhone(customer.company.phone)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {customer.contact?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge label={CUSTOMER_STATUS_LABELS[customer.status]} tone={CUSTOMER_STATUS_TONE[customer.status]} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {customer.responsible?.name ?? "Sem responsável"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(customer.becameCustomerAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {region ? (
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: region.color }} />
                      {region.name}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <CustomerFormDialog
                      customer={customer}
                      assignableUsers={assignableUsers}
                      regions={regions}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </LinkTableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

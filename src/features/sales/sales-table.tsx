import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { StatusBadge } from "@/components/status-badge";
import { SALE_STATUS_LABELS, SALE_STATUS_TONE } from "@/features/sales/labels";
import { getCustomerDisplayName } from "@/features/customers/utils";
import type { SaleListItem } from "@/features/sales/types";

export function SalesTable({ sales }: { sales: SaleListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venda</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Oportunidade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell>
                <Link
                  href={`/vendas/${sale.id}`}
                  className="text-sm font-medium hover:text-primary hover:underline"
                >
                  #{sale.id.slice(-6).toUpperCase()}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getCustomerDisplayName(sale.customer)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {sale.opportunity.title}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {sale.owner?.name ?? "Sem responsável"}
              </TableCell>
              <TableCell className="text-right text-sm">
                <div className="flex flex-col items-end">
                  <span className="font-semibold tabular-nums">{formatMoneyCents(sale.amountCents)}</span>
                  {sale.recurringAmountCents > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      +{formatMoneyCents(sale.recurringAmountCents)}/mês
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(sale.soldAt)}
              </TableCell>
              <TableCell>
                <StatusBadge label={SALE_STATUS_LABELS[sale.status]} tone={SALE_STATUS_TONE[sale.status]} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

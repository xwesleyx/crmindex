import { redirect } from "next/navigation";
import { DollarSign, ShieldAlert } from "lucide-react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatMoneyCents } from "@/lib/money";
import { listAssignableUsers } from "@/features/leads/queries";
import { listSales } from "@/features/sales/queries";
import { saleFiltersSchema } from "@/features/sales/schema";
import { SalesFilters } from "@/features/sales/sales-filters";
import { SalesTable } from "@/features/sales/sales-table";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "crm", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de CRM."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = saleFiltersSchema.parse(flatParams);

  const [{ items, total, page, pageSize, totalAmountCents }, assignableUsers] = await Promise.all([
    listSales(filters, session.user),
    listAssignableUsers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Vendas"
        description={`${total} ${total === 1 ? "venda" : "vendas"} · ${formatMoneyCents(totalAmountCents)} vendidos`}
      />

      <SalesFilters assignableUsers={assignableUsers} />

      {items.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhuma venda ainda"
          description="Vendas aparecem aqui automaticamente quando uma oportunidade é marcada como ganha no Kanban."
        />
      ) : (
        <>
          <SalesTable sales={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/vendas"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

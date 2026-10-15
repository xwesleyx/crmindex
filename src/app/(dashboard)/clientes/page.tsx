import { redirect } from "next/navigation";
import { ShieldAlert, Users } from "lucide-react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { CustomersFilters } from "@/features/customers/customers-filters";
import { CustomersTable } from "@/features/customers/customers-table";
import { NewCustomerDialog } from "@/features/customers/new-customer-dialog";
import { listCustomers } from "@/features/customers/queries";
import { customerFiltersSchema } from "@/features/customers/schema";
import { listCompanyOptions } from "@/features/companies/queries";
import { listAssignableUsers } from "@/features/leads/queries";
import { listRegions } from "@/features/regions/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "clientes", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de Clientes."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = customerFiltersSchema.parse(flatParams);

  const [{ items, total, page, pageSize }, assignableUsers, companyOptions, regions] = await Promise.all([
    listCustomers(filters, session.user),
    listAssignableUsers(),
    listCompanyOptions(),
    listRegions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Clientes"
        description={`${total} ${total === 1 ? "cliente encontrado" : "clientes encontrados"} — criados automaticamente ao ganhar uma oportunidade, ou cadastrados manualmente.`}
        action={<NewCustomerDialog companyOptions={companyOptions} assignableUsers={assignableUsers} regions={regions} />}
      />

      <CustomersFilters assignableUsers={assignableUsers} />

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Clientes aparecem aqui automaticamente quando uma oportunidade é marcada como ganha, ou use o botão Novo Cliente para cadastrar manualmente."
        />
      ) : (
        <>
          <CustomersTable
            customers={items}
            assignableUsers={assignableUsers}
            regions={regions}
            currentUser={session.user}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/clientes"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

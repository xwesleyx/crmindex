import { redirect } from "next/navigation";
import { Building2, Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { CompaniesFilters } from "@/features/companies/companies-filters";
import { CompaniesTable } from "@/features/companies/companies-table";
import { CompanyFormDialog } from "@/features/companies/company-form-dialog";
import { listCompanies } from "@/features/companies/queries";
import { companyFiltersSchema } from "@/features/companies/schema";
import { listAssignableUsers } from "@/features/leads/queries";
import { listRegions } from "@/features/regions/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function CompaniesPage({
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
  const filters = companyFiltersSchema.parse(flatParams);

  const [{ items, total, page, pageSize }, assignableUsers, regions] = await Promise.all([
    listCompanies(filters, session.user),
    listAssignableUsers(),
    listRegions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Empresas"
        description={`${total} ${total === 1 ? "empresa encontrada" : "empresas encontradas"}`}
        action={
          <CompanyFormDialog
            mode="create"
            assignableUsers={assignableUsers}
            regions={regions}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nova empresa
              </Button>
            }
          />
        }
      />

      <CompaniesFilters assignableUsers={assignableUsers} />

      {items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma empresa encontrada"
          description="Ajuste os filtros ou cadastre a primeira empresa."
        />
      ) : (
        <>
          <CompaniesTable
            companies={items}
            assignableUsers={assignableUsers}
            regions={regions}
            currentUser={session.user}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/clientes/empresas"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

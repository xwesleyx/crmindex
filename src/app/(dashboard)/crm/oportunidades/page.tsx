import { redirect } from "next/navigation";
import { Plus, ShieldAlert, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { listCompanyOptions } from "@/features/companies/queries";
import { listContactOptions } from "@/features/contacts/queries";
import { listAssignableUsers } from "@/features/leads/queries";
import { OpportunitiesFilters } from "@/features/opportunities/opportunities-filters";
import { OpportunitiesTable } from "@/features/opportunities/opportunities-table";
import { OpportunityFormDialog } from "@/features/opportunities/opportunity-form-dialog";
import { getKanbanStages, listOpportunities } from "@/features/opportunities/queries";
import { opportunityFiltersSchema } from "@/features/opportunities/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function OpportunitiesPage({
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
  const filters = opportunityFiltersSchema.parse(flatParams);

  const [{ items, total, page, pageSize }, stages, assignableUsers, companyOptions, contactOptions] =
    await Promise.all([
      listOpportunities(filters, session.user),
      getKanbanStages("COMMERCIAL"),
      listAssignableUsers(),
      listCompanyOptions(),
      listContactOptions(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Oportunidades"
        description={`${total} ${total === 1 ? "oportunidade encontrada" : "oportunidades encontradas"}`}
        action={
          <OpportunityFormDialog
            mode="create"
            stages={stages}
            contactOptions={contactOptions}
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nova oportunidade
              </Button>
            }
          />
        }
      />

      <OpportunitiesFilters
        stages={stages}
        assignableUsers={assignableUsers}
        basePath="/crm/oportunidades"
        showSort
      />

      {items.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma oportunidade encontrada"
          description="Ajuste os filtros ou crie a primeira oportunidade."
        />
      ) : (
        <>
          <OpportunitiesTable
            opportunities={items}
            stages={stages}
            contactOptions={contactOptions}
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
            currentUser={session.user}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/crm/oportunidades"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

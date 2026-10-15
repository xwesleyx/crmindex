import { redirect } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatMoneyCents } from "@/lib/money";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { listCompanyOptions } from "@/features/companies/queries";
import { listContactOptions } from "@/features/contacts/queries";
import { listAssignableUsers } from "@/features/leads/queries";
import { KanbanBoard } from "@/features/kanban/kanban-board";
import { KanbanPriorityPanel } from "@/features/kanban/kanban-priority-panel";
import { OpportunitiesFilters } from "@/features/opportunities/opportunities-filters";
import { OpportunityFormDialog } from "@/features/opportunities/opportunity-form-dialog";
import { getKanbanData } from "@/features/opportunities/queries";
import { kanbanFiltersSchema } from "@/features/opportunities/schema";
import { RegionFilterChips } from "@/features/regions/region-filter-chips";
import { listRegions } from "@/features/regions/queries";
import { parseRegionIds } from "@/features/regions/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function KanbanPage({
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
  const filters = kanbanFiltersSchema.parse(flatParams);
  const hasFilters = Object.values(flatParams).some(Boolean);
  const regionIds = parseRegionIds(flatParams.regions);

  const [
    { columns, nextTaskByOpportunity },
    assignableUsers,
    companyOptions,
    contactOptions,
    atendimentoAssignableUsers,
    regions,
  ] = await Promise.all([
    getKanbanData(filters, session.user, regionIds),
    listAssignableUsers(),
    listCompanyOptions(),
    listContactOptions(),
    listAtendimentoAssignableUsers(),
    listRegions(),
  ]);

  const stagesForFilter = columns.map((c) => c.stage);
  const totalCount = columns.reduce((sum, c) => sum + c.count, 0);
  const totalCents = columns.reduce((sum, c) => sum + c.totalCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kanban comercial"
        description={
          <>
            {hasFilters ? "Filtrado: " : "Pipeline total: "}
            {totalCount} {totalCount === 1 ? "oportunidade" : "oportunidades"} ·{" "}
            {formatMoneyCents(totalCents)}
          </>
        }
        action={
          <OpportunityFormDialog
            mode="create"
            stages={stagesForFilter}
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

      <OpportunitiesFilters stages={stagesForFilter} assignableUsers={assignableUsers} basePath="/crm/kanban" />
      <RegionFilterChips regions={regions} basePath="/crm/kanban" />
      <KanbanPriorityPanel columns={columns} />

      <KanbanBoard
        initialColumns={columns}
        nextTaskByOpportunity={nextTaskByOpportunity}
        currentUser={session.user}
        assignableUsers={atendimentoAssignableUsers}
        permissionOverrides={permissionOverrides}
      />
    </div>
  );
}

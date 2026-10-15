import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { InstallationKanbanBoard } from "@/features/installations/installation-kanban-board";
import { InstallationsFilters } from "@/features/installations/installations-filters";
import {
  getInstallationKanbanData,
  listInstallationAssignableUsers,
} from "@/features/installations/queries";
import { installationFiltersSchema } from "@/features/installations/schema";
import { RegionFilterChips } from "@/features/regions/region-filter-chips";
import { listRegions } from "@/features/regions/queries";
import { parseRegionIds } from "@/features/regions/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function InstallationKanbanPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "instalacoes", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de Instalações."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = installationFiltersSchema.parse(flatParams);
  const hasFilters = Object.values(flatParams).some(Boolean);
  const regionIds = parseRegionIds(flatParams.regions);

  const [{ columns }, assignableUsers, atendimentoAssignableUsers, regions] = await Promise.all([
    getInstallationKanbanData(filters, session.user, regionIds),
    listInstallationAssignableUsers(),
    listAtendimentoAssignableUsers(),
    listRegions(),
  ]);

  const stagesForFilter = columns.map((c) => c.stage);
  const totalCount = columns.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kanban de instalação"
        description={
          <>
            {hasFilters ? "Filtrado: " : "Total: "}
            {totalCount} {totalCount === 1 ? "instalação" : "instalações"}
          </>
        }
      />

      <InstallationsFilters
        assignableUsers={assignableUsers}
        stages={stagesForFilter}
        basePath="/instalacoes/kanban"
      />
      <RegionFilterChips regions={regions} basePath="/instalacoes/kanban" />

      <InstallationKanbanBoard
        initialColumns={columns}
        currentUser={session.user}
        atendimentoAssignableUsers={atendimentoAssignableUsers}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { ShieldAlert, Wrench } from "lucide-react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { getInstallationStages, listInstallationAssignableUsers, listInstallations } from "@/features/installations/queries";
import { installationFiltersSchema } from "@/features/installations/schema";
import { InstallationsFilters } from "@/features/installations/installations-filters";
import { InstallationsTable } from "@/features/installations/installations-table";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function InstallationsPage({
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

  const [{ items, total, page, pageSize }, assignableUsers, stages] = await Promise.all([
    listInstallations(filters, session.user),
    listInstallationAssignableUsers(),
    getInstallationStages(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Instalações"
        description={`${total} ${total === 1 ? "instalação encontrada" : "instalações encontradas"}`}
      />

      <InstallationsFilters assignableUsers={assignableUsers} stages={stages} basePath="/instalacoes" showSort />

      {items.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhuma instalação ainda"
          description="Instalações são criadas automaticamente quando uma oportunidade vira venda."
        />
      ) : (
        <>
          <InstallationsTable
            installations={items}
            assignableUsers={assignableUsers}
            currentUser={session.user}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/instalacoes"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

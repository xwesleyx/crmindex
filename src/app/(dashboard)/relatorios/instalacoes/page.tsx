import { redirect } from "next/navigation";
import { LineChart, ShieldAlert } from "lucide-react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { checklistProgress } from "@/features/installations/types";
import { INSTALLATION_STATUS_LABELS } from "@/features/installations/labels";
import { listInstallationAssignableUsers } from "@/features/installations/queries";
import { InstallationsReportFilters } from "@/features/reports/installations/installations-filters";
import { InstallationsReportTable } from "@/features/reports/installations/installations-table";
import { listInstallationsForReport } from "@/features/reports/installations/queries";
import { installationsReportFiltersSchema } from "@/features/reports/installations/schema";
import { ReportPdfButton } from "@/features/reports/pdf/report-pdf-button";
import { getCompanyLabelForFilter, getContactLabelForFilter } from "@/features/reports/queries";
import { RegionFilterChips } from "@/features/regions/region-filter-chips";
import { listRegions } from "@/features/regions/queries";
import { parseRegionIds } from "@/features/regions/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function ReportsInstallationsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "relatorios_instalacoes", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao relatório de instalações."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = installationsReportFiltersSchema.parse(flatParams);
  const regionIds = parseRegionIds(flatParams.regions);

  const [{ items, total, page, pageSize }, assignableUsers, regions, initialContactLabel, initialCompanyLabel] =
    await Promise.all([
      listInstallationsForReport(filters, session.user, regionIds),
      listInstallationAssignableUsers(),
      listRegions(),
      filters.contactId ? getContactLabelForFilter(filters.contactId) : null,
      filters.companyId ? getCompanyLabelForFilter(filters.companyId) : null,
    ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Relatório de Instalações"
        description={`${total} ${total === 1 ? "instalação encontrada" : "instalações encontradas"}`}
        action={
          <ReportPdfButton
            title="Relatório de Instalações"
            subtitle={`${total} registro(s) nesta página`}
            fileName="relatorio-instalacoes.pdf"
            columns={["Cliente", "Responsável", "Etapa", "Status", "Checklist", "Agendada", "Concluída", "Criada em"]}
            rows={items.map((i) => {
              const progress = checklistProgress(i.checklistItems);
              return [
                getCustomerDisplayName(i.customer),
                i.responsible?.name ?? "Sem responsável",
                i.stage.name,
                INSTALLATION_STATUS_LABELS[i.status],
                `${progress.done}/${progress.total} (${progress.percent}%)`,
                i.scheduledAt ? formatDate(i.scheduledAt) : "—",
                i.completedAt ? formatDate(i.completedAt) : "—",
                formatDate(i.createdAt),
              ];
            })}
          />
        }
      />

      <InstallationsReportFilters
        assignableUsers={assignableUsers}
        initialContactLabel={initialContactLabel}
        initialCompanyLabel={initialCompanyLabel}
      />
      <RegionFilterChips regions={regions} basePath="/relatorios/instalacoes" />

      {items.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Nenhuma instalação encontrada"
          description="Ajuste os filtros de busca."
        />
      ) : (
        <>
          <InstallationsReportTable installations={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/relatorios/instalacoes"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

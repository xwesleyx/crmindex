import { redirect } from "next/navigation";
import { LineChart, ShieldAlert } from "lucide-react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDate } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { listAssignableUsers } from "@/features/leads/queries";
import { ORIGIN_LABELS, OPPORTUNITY_STATUS_LABELS } from "@/features/opportunities/labels";
import { CommercialReportFilters } from "@/features/reports/commercial/commercial-filters";
import { CommercialReportTable } from "@/features/reports/commercial/commercial-table";
import { listOpportunitiesForReport } from "@/features/reports/commercial/queries";
import { commercialReportFiltersSchema } from "@/features/reports/commercial/schema";
import { ReportPdfButton } from "@/features/reports/pdf/report-pdf-button";
import { getCompanyLabelForFilter, getContactLabelForFilter } from "@/features/reports/queries";
import { RegionFilterChips } from "@/features/regions/region-filter-chips";
import { listRegions } from "@/features/regions/queries";
import { parseRegionIds } from "@/features/regions/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function ReportsCommercialPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "relatorios_comercial", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao relatório comercial."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = commercialReportFiltersSchema.parse(flatParams);
  const regionIds = parseRegionIds(flatParams.regions);

  const [{ items, total, page, pageSize }, assignableUsers, regions, initialContactLabel, initialCompanyLabel] =
    await Promise.all([
      listOpportunitiesForReport(filters, session.user, regionIds),
      listAssignableUsers(),
      listRegions(),
      filters.contactId ? getContactLabelForFilter(filters.contactId) : null,
      filters.companyId ? getCompanyLabelForFilter(filters.companyId) : null,
    ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Relatório Comercial"
        description={`${total} ${total === 1 ? "oportunidade encontrada" : "oportunidades encontradas"}`}
        action={
          <ReportPdfButton
            title="Relatório Comercial"
            subtitle={`${total} registro(s) nesta página`}
            fileName="relatorio-comercial.pdf"
            columns={["Título", "Empresa/Contato", "Responsável", "Etapa", "Valor", "Status", "Origem", "Criada em"]}
            rows={items.map((o) => [
              o.title,
              o.company ? o.company.tradeName || o.company.legalName : (o.contact?.name ?? "—"),
              o.owner?.name ?? "Sem responsável",
              o.stage.name,
              formatMoneyCents(o.estimatedValueCents),
              OPPORTUNITY_STATUS_LABELS[o.status],
              ORIGIN_LABELS[o.origin],
              formatDate(o.createdAt),
            ])}
          />
        }
      />

      <CommercialReportFilters
        assignableUsers={assignableUsers}
        initialContactLabel={initialContactLabel}
        initialCompanyLabel={initialCompanyLabel}
      />
      <RegionFilterChips regions={regions} basePath="/relatorios/comercial" />

      {items.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Nenhuma oportunidade encontrada"
          description="Ajuste os filtros de busca."
        />
      ) : (
        <>
          <CommercialReportTable opportunities={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/relatorios/comercial"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

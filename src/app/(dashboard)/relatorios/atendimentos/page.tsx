import { redirect } from "next/navigation";
import { LineChart, ShieldAlert } from "lucide-react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { getConversationDisplayStatus } from "@/features/atendimento/labels";
import { ReportsFilters } from "@/features/reports/reports-filters";
import { ReportsTable } from "@/features/reports/reports-table";
import {
  getCompanyLabelForFilter,
  getContactLabelForFilter,
  listConversationsForReport,
} from "@/features/reports/queries";
import { reportsFiltersSchema } from "@/features/reports/schema";
import { ReportPdfButton } from "@/features/reports/pdf/report-pdf-button";
import { RegionFilterChips } from "@/features/regions/region-filter-chips";
import { listRegions } from "@/features/regions/queries";
import { parseRegionIds } from "@/features/regions/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

// Controle de atendimentos (pesquisar, ler conversas, ver quem atendeu) —
// diferente da Central (atendimento/), que só mostra o que está em
// andamento, aqui aparece tudo, inclusive encerradas.
export default async function ReportsAtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "relatorios_atendimento", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso aos relatórios de atendimento."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = reportsFiltersSchema.parse(flatParams);
  const regionIds = parseRegionIds(flatParams.regions);

  const [{ items, total, page, pageSize }, assignableUsers, regions, initialContactLabel, initialCompanyLabel] =
    await Promise.all([
      listConversationsForReport(filters, regionIds),
      listAtendimentoAssignableUsers(),
      listRegions(),
      filters.contactId ? getContactLabelForFilter(filters.contactId) : null,
      filters.companyId ? getCompanyLabelForFilter(filters.companyId) : null,
    ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Relatório de Atendimentos"
        description={`${total} ${total === 1 ? "atendimento encontrado" : "atendimentos encontrados"}`}
        action={
          <ReportPdfButton
            title="Relatório de Atendimentos"
            subtitle={`${total} registro(s) nesta página`}
            fileName="relatorio-atendimentos.pdf"
            columns={["Contato", "Empresa", "Quem atendeu", "Status", "Última mensagem"]}
            rows={items.map((c) => [
              c.contact.name,
              c.contact.company ? c.contact.company.tradeName || c.contact.company.legalName : "—",
              c.assignee?.name ?? "Sem responsável",
              getConversationDisplayStatus(c).label,
              formatDateTime(c.lastMessageAt),
            ])}
          />
        }
      />

      <ReportsFilters
        assignableUsers={assignableUsers}
        basePath="/relatorios/atendimentos"
        initialContactLabel={initialContactLabel}
        initialCompanyLabel={initialCompanyLabel}
      />
      <RegionFilterChips regions={regions} basePath="/relatorios/atendimentos" />

      {items.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Nenhum atendimento encontrado"
          description="Ajuste os filtros de busca."
        />
      ) : (
        <>
          <ReportsTable conversations={items} />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/relatorios/atendimentos"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

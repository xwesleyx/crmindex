import { redirect } from "next/navigation";
import { ShieldAlert, UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import { LeadsFilters } from "@/features/leads/leads-filters";
import { LeadsTable } from "@/features/leads/leads-table";
import { leadFiltersSchema } from "@/features/leads/schema";
import { listAssignableUsers, listLeads } from "@/features/leads/queries";
import { getKanbanStages } from "@/features/opportunities/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function LeadsPage({
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
  const filters = leadFiltersSchema.parse(flatParams);

  const [{ items, total, page, pageSize }, assignableUsers, stages, atendimentoAssignableUsers] =
    await Promise.all([
      listLeads(filters, session.user),
      listAssignableUsers(),
      getKanbanStages("COMMERCIAL"),
      listAtendimentoAssignableUsers(),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leads"
        description={`${total} ${total === 1 ? "lead encontrado" : "leads encontrados"}`}
        action={
          <LeadFormDialog
            mode="create"
            assignableUsers={assignableUsers}
            trigger={
              <Button size="sm">
                <UserPlus className="size-4" />
                Novo Lead
              </Button>
            }
          />
        }
      />

      <LeadsFilters assignableUsers={assignableUsers} />

      {items.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou crie o primeiro lead para começar o funil comercial."
        />
      ) : (
        <>
          <LeadsTable
            leads={items}
            assignableUsers={assignableUsers}
            stages={stages}
            currentUser={session.user}
            atendimentoAssignableUsers={atendimentoAssignableUsers}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/crm/leads"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

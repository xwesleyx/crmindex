import { redirect } from "next/navigation";
import { Plus, ShieldAlert, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { listCompanyOptions } from "@/features/companies/queries";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { ContactsFilters } from "@/features/contacts/contacts-filters";
import { ContactsTable } from "@/features/contacts/contacts-table";
import { listContacts } from "@/features/contacts/queries";
import { contactFiltersSchema } from "@/features/contacts/schema";
import { listAssignableUsers } from "@/features/leads/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function ContactsPage({
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
  const filters = contactFiltersSchema.parse(flatParams);

  const [{ items, total, page, pageSize }, assignableUsers, companyOptions] = await Promise.all([
    listContacts(filters, session.user),
    listAssignableUsers(),
    listCompanyOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contatos"
        description={`${total} ${total === 1 ? "contato encontrado" : "contatos encontrados"}`}
        action={
          <ContactFormDialog
            mode="create"
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Novo contato
              </Button>
            }
          />
        }
      />

      <ContactsFilters companyOptions={companyOptions} assignableUsers={assignableUsers} />

      {items.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Nenhum contato encontrado"
          description="Ajuste os filtros ou cadastre o primeiro contato."
        />
      ) : (
        <>
          <ContactsTable
            contacts={items}
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
            currentUser={session.user}
          />
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/clientes/contatos"
            searchParams={flatParams}
          />
        </>
      )}
    </div>
  );
}

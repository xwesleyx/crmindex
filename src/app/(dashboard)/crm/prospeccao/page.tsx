import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProspeccaoPanel } from "@/features/prospeccao/prospeccao-panel";
import { getProspeccaoDraft } from "@/features/prospeccao/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function ProspeccaoPage() {
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

  const draft = await getProspeccaoDraft(session.user.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Prospecção CNPJ"
        description="Busque empresas abertas recentemente numa cidade e transforme em Lead."
      />
      <ProspeccaoPanel initialFilters={draft.filters} initialResults={draft.results} />
    </div>
  );
}

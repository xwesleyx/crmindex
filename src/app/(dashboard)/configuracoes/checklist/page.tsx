import { redirect } from "next/navigation";
import { ClipboardCheck, Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { ChecklistTemplateItemDialog } from "@/features/checklist-templates/checklist-template-item-dialog";
import { ChecklistTemplateList } from "@/features/checklist-templates/checklist-template-list";
import { listChecklistTemplateItems } from "@/features/checklist-templates/queries";
import { auth } from "@/lib/auth";

export default async function ChecklistTemplatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar o checklist padrão."
      />
    );
  }

  const items = await listChecklistTemplateItems();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Checklist de Instalação"
        description="Itens que toda instalação nova já nasce com — editar aqui não muda instalações existentes."
        action={
          <ChecklistTemplateItemDialog
            mode="create"
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Novo item
              </Button>
            }
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum item no checklist padrão"
          description="Instalações novas vão nascer sem nenhum item até você adicionar o primeiro."
        />
      ) : (
        <ChecklistTemplateList items={items} />
      )}
    </div>
  );
}

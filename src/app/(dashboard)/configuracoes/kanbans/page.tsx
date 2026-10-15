import { redirect } from "next/navigation";
import { Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { TabPills } from "@/components/tab-pills";
import { KanbanStageFormDialog } from "@/features/kanban-stages/kanban-stage-form-dialog";
import { KanbanStageList } from "@/features/kanban-stages/kanban-stage-list";
import { listKanbanStagesForConfig } from "@/features/kanban-stages/queries";
import { auth } from "@/lib/auth";

// Uma aba por board — o board aberto fica na URL (?board=instalacao), pra
// link direto e "voltar" do navegador funcionarem. Sem parâmetro (ou com
// valor desconhecido), abre o CRM.
const BOARD_TABS = [
  {
    param: "crm",
    board: "COMMERCIAL",
    label: "CRM",
    description: "Etapas do Kanban Comercial (CRM) — nome, cor, ordem e quais existem.",
  },
  {
    param: "instalacao",
    board: "INSTALLATION",
    label: "Instalação",
    description: "Etapas do Kanban de Instalação — nome, cor, ordem e quais existem.",
  },
] as const;

export default async function KanbansConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar as etapas do Kanban."
      />
    );
  }

  const { board: boardParam } = await searchParams;
  const current = BOARD_TABS.find((tab) => tab.param === boardParam) ?? BOARD_TABS[0];
  const stages = await listKanbanStagesForConfig(current.board);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kanbans"
        tabs={
          <TabPills
            label="Kanbans"
            tabs={BOARD_TABS.map((tab) => ({
              label: tab.label,
              href: `/configuracoes/kanbans?board=${tab.param}`,
              active: tab.param === current.param,
            }))}
          />
        }
        description={current.description}
        action={
          <KanbanStageFormDialog
            mode="create"
            board={current.board}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nova etapa
              </Button>
            }
          />
        }
      />

      <KanbanStageList stages={stages} />
    </div>
  );
}

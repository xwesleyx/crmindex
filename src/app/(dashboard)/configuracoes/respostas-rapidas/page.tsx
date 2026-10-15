import { redirect } from "next/navigation";
import { MessageSquareText, Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { QuickReplyFormDialog } from "@/features/quick-replies/quick-reply-form-dialog";
import { QuickReplyList } from "@/features/quick-replies/quick-reply-list";
import { listQuickReplies } from "@/features/quick-replies/queries";
import { auth } from "@/lib/auth";

export default async function QuickRepliesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar respostas rápidas."
      />
    );
  }

  const items = await listQuickReplies();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Atendimento"
        tabs={<SettingsTabs group="atendimento" />}
        description={
          'Atalhos usados no Atendimento: digitar "/" no campo de mensagem mostra a lista, escolher preenche o texto (e o atendente aperta Enter para enviar).'
        }
        action={
          <QuickReplyFormDialog
            mode="create"
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Nova resposta rápida
              </Button>
            }
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nenhuma resposta rápida cadastrada"
          description='Crie a primeira, por exemplo "/p" para "Obrigado pela preferência!".'
        />
      ) : (
        <QuickReplyList items={items} />
      )}
    </div>
  );
}

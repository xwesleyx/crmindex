import { redirect } from "next/navigation";
import { MessageSquare, ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { AtendimentoLayout } from "@/features/atendimento/atendimento-layout";
import { AtendimentoHeader } from "@/features/atendimento/atendimento-header";
import { AtendimentoMetrics } from "@/features/atendimento/atendimento-metrics";
import { ConversationList } from "@/features/atendimento/conversation-list";
import { getAtendimentoViewer } from "@/features/atendimento/permissions";
import {
  getAtendimentoMetrics,
  listConversations,
  countStatusesForTab,
} from "@/features/atendimento/queries";
import { conversationFiltersSchema } from "@/features/atendimento/schema";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "atendimento", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso à Central de Atendimento."
      />
    );
  }

  const flatParams = flattenSearchParams(await searchParams);
  const filters = conversationFiltersSchema.parse(flatParams);

  const viewer = await getAtendimentoViewer(session.user);
  const [conversations, metrics, tabStatusCounts] = await Promise.all([
    listConversations(filters, viewer),
    getAtendimentoMetrics(viewer),
    countStatusesForTab(filters.filter, viewer),
  ]);

  return (
    <div className="atendimento-theme flex h-[calc(100dvh-6.75rem)] min-h-[520px] flex-col gap-3">
      <AtendimentoHeader />
      <AtendimentoMetrics metrics={metrics} />
      <AtendimentoLayout
        hasSelection={false}
        list={
          <ConversationList
            conversations={conversations}
            currentUser={session.user}
            statusCounts={{ ...metrics, ...tabStatusCounts }}
          />
        }
        main={
          <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-border bg-card">
            <EmptyState
              icon={MessageSquare}
              title="Selecione uma conversa"
              description="Escolha um atendimento na lista à esquerda ou inicie uma nova conversa."
            />
          </div>
        }
      />
    </div>
  );
}

import { listRegions } from "@/features/regions/queries";
import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { AtendimentoLayout } from "@/features/atendimento/atendimento-layout";
import { AtendimentoHeader } from "@/features/atendimento/atendimento-header";
import { AtendimentoMetrics } from "@/features/atendimento/atendimento-metrics";
import { ChatPanel } from "@/features/atendimento/chat-panel";
import { ConversationList } from "@/features/atendimento/conversation-list";
import { ContextPanel } from "@/features/atendimento/context-panel";
import {
  canEditConversation,
  getAtendimentoViewer,
} from "@/features/atendimento/permissions";
import {
  getAtendimentoMetrics,
  getConversation,
  getConversationActivities,
  getConversationMessages,
  listAtendimentoAssignableUsers,
  listConversations,
  listConversationsForContact,
  countStatusesForTab,
} from "@/features/atendimento/queries";
import { conversationFiltersSchema } from "@/features/atendimento/schema";
import { listCompanyOptions } from "@/features/companies/queries";
import { listAssignableUsers } from "@/features/leads/queries";
import { getKanbanStages } from "@/features/opportunities/queries";
import { listQuickReplies } from "@/features/quick-replies/queries";
import { getTasksForEntity } from "@/features/tasks/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { flattenSearchParams, type RawSearchParams } from "@/lib/search-params";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(
    session.user.id,
  );

  if (!isModuleVisible(session.user.role, "atendimento", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso à Central de Atendimento."
      />
    );
  }

  const { id } = await params;
  const flatParams = flattenSearchParams(await searchParams);
  const filters = conversationFiltersSchema.parse(flatParams);

  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const viewer = await getAtendimentoViewer(session.user);
  if (!canEditConversation(viewer, conversation)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Este atendimento pertence a outro responsável."
      />
    );
  }

  const [
    conversations,
    metrics,
    messages,
    activities,
    assignableUsers,
    stages,
    history,
    companyOptions,
    crmAssignableUsers,
    tasks,
    quickReplies,
    regions,
    tabStatusCounts,
  ] = await Promise.all([
    listConversations(filters, viewer),
    getAtendimentoMetrics(viewer),
    getConversationMessages(id),
    getConversationActivities(id),
    listAtendimentoAssignableUsers(),
    getKanbanStages("COMMERCIAL"),
    listConversationsForContact(conversation.contactId, id),
    listCompanyOptions(),
    listAssignableUsers(),
    getTasksForEntity("Conversation", id),
    listQuickReplies(),
    listRegions(),
    countStatusesForTab(filters.filter, viewer),
  ]);

  return (
    <div className="atendimento-theme flex h-[calc(100dvh-6.75rem)] min-h-[520px] flex-col gap-3">
      <AtendimentoHeader />
      <AtendimentoMetrics metrics={metrics} />
      <AtendimentoLayout
        hasSelection
        list={
          <ConversationList
            conversations={conversations}
            selectedId={id}
            currentUser={session.user}
            statusCounts={{ ...metrics, ...tabStatusCounts }}
          />
        }
        main={
          <ChatPanel
            key={id}
            conversation={conversation}
            initialMessages={messages}
            assignableUsers={assignableUsers}
            quickReplies={quickReplies}
            currentUser={session.user}
            contextPanel={
              <ContextPanel
                conversation={conversation}
                activities={activities}
                history={history}
                stages={stages}
                assignableUsers={assignableUsers}
                companyOptions={companyOptions}
                crmAssignableUsers={crmAssignableUsers}
                regions={regions}
                currentUser={session.user}
                canSupervise={viewer.viewAll}
                canCreateOpportunity={viewer.canCreateOpportunity}
                tasks={tasks}
              />
            }
          />
        }
        context={
          <ContextPanel
            conversation={conversation}
            activities={activities}
            history={history}
            stages={stages}
            assignableUsers={assignableUsers}
            companyOptions={companyOptions}
            crmAssignableUsers={crmAssignableUsers}
            regions={regions}
            currentUser={session.user}
            canSupervise={viewer.viewAll}
            canCreateOpportunity={viewer.canCreateOpportunity}
            tasks={tasks}
          />
        }
      />
    </div>
  );
}

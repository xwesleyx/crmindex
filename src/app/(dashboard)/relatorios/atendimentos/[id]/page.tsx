import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { EntityTimeline } from "@/components/entity-timeline";
import { PageHeader } from "@/components/page-header";
import { MessageBubble } from "@/features/atendimento/message-bubble";
import { ContactCard } from "@/features/atendimento/contact-card";
import { AttendanceInfoCard } from "@/features/atendimento/info-card";
import { ReopenConversationButton } from "@/features/reports/reopen-conversation-button";
import {
  getConversation,
  getConversationActivities,
  getConversationMessages,
  listAtendimentoAssignableUsers,
} from "@/features/atendimento/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

function describeConversationActivity(activity: { action: string; metadata: string | null }): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};
  switch (activity.action) {
    case "conversation.started":
      return "iniciou o atendimento";
    case "conversation.assigned":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "conversation.status_change":
      return `alterou o status: ${metadata.from} → ${metadata.to}`;
    case "conversation.priority_change":
      return `alterou a prioridade: ${metadata.from} → ${metadata.to}`;
    case "conversation.opportunity_created":
      return "criou uma oportunidade a partir do atendimento";
    case "conversation.contact_linked":
      return `identificou o contato: ${metadata.contactName ?? ""}`;
    case "conversation.customer_linked":
      return "vinculou a conversa a um cliente";
    case "conversation.transferred":
      return `transferiu: ${metadata.fromQueue ?? "sem fila"} → ${metadata.toQueue ?? "sem fila"}${metadata.toAssigneeName ? ` · ${metadata.toAssigneeName}` : ""}`;
    case "conversation.participant_added":
      return metadata.self ? "entrou na conversa como participante" : `adicionou ${metadata.name ?? "um atendente"} à conversa`;
    case "conversation.participant_removed":
      return metadata.self ? "saiu da conversa" : `removeu ${metadata.name ?? "um atendente"} da conversa`;
    case "conversation.closed":
      return "encerrou o atendimento";
    default:
      return activity.action;
  }
}

// Leitura de um atendimento (Relatórios) — transcrição completa, sem caixa
// de resposta: aqui é só consulta ("ver quem atendeu", auditoria).
export default async function ReportConversationPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  const [messages, activities, assignableUsers] = await Promise.all([
    getConversationMessages(id),
    getConversationActivities(id),
    listAtendimentoAssignableUsers(),
  ]);

  const isClosed = conversation.status === "CLOSED" || conversation.status === "RESOLVED";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={conversation.contact.name}
        description="Transcrição do atendimento"
        action={
          <div className="flex items-center gap-2">
            {isClosed && <ReopenConversationButton conversationId={conversation.id} />}
            <Link
              href="/relatorios/atendimentos"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem mensagens.</p>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Contato</h3>
            <ContactCard
              phone={conversation.contact.phone ?? conversation.contact.whatsapp}
              secondary={conversation.contact.whatsapp}
            />
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Informações</h3>
            <AttendanceInfoCard
              conversation={conversation}
              assignableUsers={assignableUsers}
              currentUser={session.user}
              canSupervise={false}
            />
          </section>

          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Histórico</h3>
            <EntityTimeline activities={activities} describe={describeConversationActivity} />
          </section>
        </div>
      </div>
    </div>
  );
}

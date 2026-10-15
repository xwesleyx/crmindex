import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/components/entity-avatar";
import { StatusBadge } from "@/components/status-badge";
import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";
import { formatDateTime, formatRelative } from "@/lib/format";
import { CONTACT_LINK_TYPE_LABELS } from "@/features/contacts/labels";
import { ContactNameEditor } from "@/features/contacts/contact-name-editor";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_TONE } from "@/features/customers/labels";
import { CONVERSATION_QUEUE_LABELS } from "@/features/atendimento/labels";
import { ContactCard } from "@/features/atendimento/contact-card";
import { CultureSection } from "@/features/atendimento/conversation-culture-ui";
import { getConversationCulture } from "@/features/atendimento/conversation-culture";
import { CreateOpportunityDialog } from "@/features/atendimento/create-opportunity-dialog";
import { AttendanceInfoCard } from "@/features/atendimento/info-card";
import { UnidentifiedContactBanner } from "@/features/atendimento/unidentified-contact-banner";
import { TaskList } from "@/features/tasks/task-list";
import type { TaskItem } from "@/features/tasks/types";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";
import type { ConversationDetail, ConversationHistoryItem } from "@/features/atendimento/types";

function describeConversationActivity(activity: ActivityWithUser): string {
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

// Painel de contexto comercial (seção 8/12 do adendo): o atendente não deve
// precisar sair da conversa pra saber a situação daquele contato. Contato/
// Empresa/Relacionamento como blocos separados (seção 8), banner de
// identificação quando o contato ainda é um "contato-sombra" (seção 6).
export function ContextPanel({
  conversation,
  activities,
  history,
  stages,
  assignableUsers,
  companyOptions,
  crmAssignableUsers,
  regions,
  tasks,
  currentUser,
  canSupervise,
  canCreateOpportunity,
}: {
  conversation: ConversationDetail;
  activities: ActivityWithUser[];
  history: ConversationHistoryItem[];
  stages: { id: string; name: string }[];
  assignableUsers: AssignableUser[];
  companyOptions: CompanyOption[];
  crmAssignableUsers: AssignableUser[];
  regions: RegionListItem[];
  tasks: TaskItem[];
  currentUser: { id: string };
  // Admin/Gerente: veem todas as conversas e gerenciam participantes de
  // qualquer uma (permissão "Ver atendimento de todos", viewer.viewAll).
  canSupervise: boolean;
  // Permissão "Criar oportunidade pelo Atendimento" (padrão Vendedor e
  // Administrador — Configurações > Permissões).
  canCreateOpportunity: boolean;
}) {
  const { contact, lead, opportunity, customer } = conversation;
  const companyCustomerStatus = contact.company?.customer?.status ?? null;
  const culture = getConversationCulture(conversation);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {!contact.identified && (
        <UnidentifiedContactBanner
          conversation={conversation}
          companyOptions={companyOptions}
          crmAssignableUsers={crmAssignableUsers}
          regions={regions}
        />
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Contato</h3>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage src={`/api/atendimento/contact-photo/${contact.id}`} alt={`Foto de ${contact.name}`} />
              <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <ContactNameEditor
                contactId={contact.id}
                name={contact.name}
                whatsappName={contact.whatsappName}
                variant="compact"
              />
              {(contact.role || contact.linkType) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[contact.role, contact.linkType ? CONTACT_LINK_TYPE_LABELS[contact.linkType] : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
          <ContactCard phone={contact.phone ?? contact.whatsapp} secondary={contact.whatsapp} />
          {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
        </div>
      </section>

      {culture && (
        <CultureSection
          culture={culture}
          customerName={contact.company ? contact.company.tradeName || contact.company.legalName : contact.name}
        />
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Informações</h3>
        <AttendanceInfoCard
          conversation={conversation}
          assignableUsers={assignableUsers}
          currentUser={currentUser}
          canSupervise={canSupervise}
        />
      </section>

      {/* Fica disponível mesmo com a conversa encerrada (canManage não olha
          pro status) — o pedido explícito era poder criar uma tarefa
          vinculada ao atendimento mesmo já fechado. */}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Tarefas</h3>
        <TaskList
          tasks={tasks}
          entityType="Conversation"
          entityId={conversation.id}
          assignableUsers={assignableUsers}
          canManage
        />
      </section>

      {contact.company && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Empresa</h3>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5 text-sm">
            <Link
              href={`/clientes/empresas/${contact.company.id}`}
              className="font-medium text-primary hover:underline"
            >
              {contact.company.tradeName || contact.company.legalName}
            </Link>
            <StatusBadge
              label={
                companyCustomerStatus ? CUSTOMER_STATUS_LABELS[companyCustomerStatus] : "Não é cliente"
              }
              tone={companyCustomerStatus ? CUSTOMER_STATUS_TONE[companyCustomerStatus] : "neutral"}
              className="w-fit"
            />
          </div>
        </section>
      )}

      {customer && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Relacionamento</h3>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2.5 text-sm">
            <Link href={`/clientes/${customer.id}`} className="font-medium text-primary hover:underline">
              Ver cliente
            </Link>
            <p className="text-xs text-muted-foreground">
              Cliente desde {formatDateTime(customer.becameCustomerAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              Responsável: {customer.responsible?.name ?? "Sem responsável"}
            </p>
          </div>
        </section>
      )}

      {lead && !opportunity && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Lead</h3>
          <div className="rounded-lg border border-border p-2.5 text-sm">
            <Link href={`/crm/leads/${lead.id}`} className="font-medium text-primary hover:underline">
              {lead.name}
            </Link>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">Conversas anteriores</h3>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {history.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/atendimento/${item.id}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs hover:bg-muted"
                >
                  <span className="text-muted-foreground">
                    {formatRelative(item.createdAt)}
                    {item.queue ? ` · ${CONVERSATION_QUEUE_LABELS[item.queue]}` : ""}
                  </span>
                  <span className="text-muted-foreground">{item.assignee?.name ?? "Sem responsável"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Histórico</h3>
        <EntityTimeline activities={activities} describe={describeConversationActivity} />
      </section>

      {/* Criar oportunidade: no fim do painel, só quando a empresa do contato
          ainda não é cliente (cliente já tem relacionamento — oportunidade
          nova sai pelo CRM) e para quem tem a permissão. */}
      {!opportunity && contact.identified && !contact.company?.customer && canCreateOpportunity && (
        <CreateOpportunityDialog conversation={conversation} stages={stages} assignableUsers={assignableUsers} />
      )}
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { TemperatureBadge } from "@/components/temperature-badge";
import { formatDateTime } from "@/lib/format";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import {
  LEAD_ORIGIN_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONE,
} from "@/features/leads/labels";
import { LeadDetailActions } from "@/features/leads/lead-detail-actions";
import { LeadTimeline } from "@/features/leads/lead-timeline";
import { canEditLead } from "@/features/leads/permissions";
import { getLead, getLeadActivities, listAssignableUsers } from "@/features/leads/queries";
import { getKanbanStages } from "@/features/opportunities/queries";
import { TemperatureSignalsCard } from "@/features/temperature/temperature-signals-card";
import { TaskList } from "@/features/tasks/task-list";
import { getTasksForEntity } from "@/features/tasks/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const canEdit = canEditLead(session.user.role, session.user.id, lead);
  if (!canEdit) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Este lead pertence a outro responsável."
      />
    );
  }

  const [assignableUsers, activities, stages, atendimentoAssignableUsers, tasks] = await Promise.all([
    listAssignableUsers(),
    getLeadActivities(lead.id),
    getKanbanStages("COMMERCIAL"),
    listAtendimentoAssignableUsers(),
    getTasksForEntity("Lead", lead.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/crm/leads"
        backLabel="Leads"
        title={
          <>
            {lead.name}
            <StatusBadge label={LEAD_STATUS_LABELS[lead.status]} tone={LEAD_STATUS_TONE[lead.status]} />
            <TemperatureBadge temperature={lead.temperature} />
            <PriorityBadge priority={lead.priority} />
            {lead.deletedAt && <Badge variant="outline">Arquivado</Badge>}
          </>
        }
        description={
          lead.opportunity ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {[lead.companyName, lead.phone].filter(Boolean).join(" · ")}
              <span>·</span>
              <Link
                href={`/crm/oportunidades/${lead.opportunity.id}`}
                className="text-primary hover:underline"
              >
                Ver oportunidade convertida
              </Link>
            </span>
          ) : (
            [lead.companyName, lead.phone].filter(Boolean).join(" · ")
          )
        }
        action={
          <LeadDetailActions
            lead={lead}
            assignableUsers={assignableUsers}
            stages={stages}
            canEdit={canEdit}
            atendimentoAssignableUsers={atendimentoAssignableUsers}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Field label="Telefone" value={lead.phone} />
              <Field label="WhatsApp" value={lead.whatsapp ?? "—"} />
              <Field label="E-mail" value={lead.email ?? "—"} />
              <Field
                label="Empresa"
                value={
                  lead.sourceCompanyId ? (
                    <Link href={`/clientes/empresas/${lead.sourceCompanyId}`} className="text-primary hover:underline">
                      {lead.companyName ?? "Ver empresa"}
                    </Link>
                  ) : (
                    (lead.companyName ?? "—")
                  )
                }
              />
              <Field label="CNPJ" value={lead.companyCnpj ?? "—"} />
              <Field label="Origem" value={LEAD_ORIGIN_LABELS[lead.origin]} />
              <Field label="Responsável" value={lead.responsible?.name ?? "Sem responsável"} />
              <Field label="Criado em" value={formatDateTime(lead.createdAt)} />
              <Field label="Última interação" value={formatDateTime(lead.lastInteractionAt)} />
              <Field label="Próxima ação" value={formatDateTime(lead.nextActionAt)} />
              <Field label="Nota da próxima ação" value={lead.nextActionNote ?? "—"} />
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{lead.notes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <TemperatureSignalsCard
            entityKind="lead"
            entityId={lead.id}
            temperature={lead.temperature}
            score={lead.temperatureScore}
            override={lead.temperatureOverride}
            signals={{
              pedeProposta: lead.signalPedeProposta,
              perguntouPreco: lead.signalPerguntouPreco,
              pedeDemo: lead.signalPedeDemo,
              informouPrazo: lead.signalInformouPrazo,
              problemaUrgente: lead.signalProblemaUrgente,
            }}
            canManage={canEdit}
          />

          <Card size="sm">
            <CardHeader>
              <CardTitle>Tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList
                tasks={tasks}
                entityType="Lead"
                entityId={lead.id}
                assignableUsers={assignableUsers}
                canManage={canEdit}
              />
            </CardContent>
          </Card>
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

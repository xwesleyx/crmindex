import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { TemperatureBadge } from "@/components/temperature-badge";
import { MoneyDisplay } from "@/components/money-display";
import { formatDate, formatDateTime } from "@/lib/format";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { listCompanyOptions } from "@/features/companies/queries";
import { listContactOptions } from "@/features/contacts/queries";
import { listAssignableUsers } from "@/features/leads/queries";
import {
  ORIGIN_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_STATUS_TONE,
} from "@/features/opportunities/labels";
import { OpportunityDetailActions } from "@/features/opportunities/opportunity-detail-actions";
import { OpportunityTimeline } from "@/features/opportunities/opportunity-timeline";
import { canEditOpportunity } from "@/features/opportunities/permissions";
import {
  getKanbanStages,
  getOpportunity,
  getOpportunityActivities,
} from "@/features/opportunities/queries";
import { getTasksForEntity } from "@/features/tasks/queries";
import { TaskList } from "@/features/tasks/task-list";
import { TemperatureSignalsCard } from "@/features/temperature/temperature-signals-card";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function OpportunityDetailPage({
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
  const opportunity = await getOpportunity(id);
  if (!opportunity) notFound();

  const canEdit = canEditOpportunity(session.user.role, session.user.id, opportunity);
  if (!canEdit) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Esta oportunidade pertence a outro responsável."
      />
    );
  }

  const [
    stages,
    assignableUsers,
    companyOptions,
    contactOptions,
    activities,
    tasks,
    atendimentoAssignableUsers,
  ] = await Promise.all([
    getKanbanStages("COMMERCIAL"),
    listAssignableUsers(),
    listCompanyOptions(),
    listContactOptions(),
    getOpportunityActivities(opportunity.id),
    getTasksForEntity("Opportunity", opportunity.id),
    listAtendimentoAssignableUsers(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/crm/oportunidades"
        backLabel="Oportunidades"
        title={
          <>
            {opportunity.title}
            <Badge variant="outline">{opportunity.stage.name}</Badge>
            <StatusBadge
              label={OPPORTUNITY_STATUS_LABELS[opportunity.status]}
              tone={OPPORTUNITY_STATUS_TONE[opportunity.status]}
              solid={opportunity.status === "WON"}
            />
            <TemperatureBadge temperature={opportunity.temperature} />
            <PriorityBadge priority={opportunity.priority} />
          </>
        }
        description={
          <span className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-1.5">
              <MoneyDisplay cents={opportunity.estimatedValueCents} size="xl" />
              {opportunity.recurringValueCents > 0 && (
                <span className="text-sm text-muted-foreground">
                  + <MoneyDisplay cents={opportunity.recurringValueCents} size="sm" muted /> /mês
                </span>
              )}
            </span>
            <span>{opportunity.owner?.name ?? "Sem responsável"}</span>
          </span>
        }
        action={
          <OpportunityDetailActions
            opportunity={opportunity}
            stages={stages}
            contactOptions={contactOptions}
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
            atendimentoAssignableUsers={atendimentoAssignableUsers}
          />
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Comercial</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Field
                label="Empresa"
                value={opportunity.company ? opportunity.company.tradeName || opportunity.company.legalName : "—"}
                href={opportunity.companyId ? `/clientes/empresas/${opportunity.companyId}` : undefined}
              />
              <Field
                label="Contato"
                value={opportunity.contact?.name ?? "—"}
                href={opportunity.contactId ? `/clientes/contatos/${opportunity.contactId}` : undefined}
              />
              <Field label="Origem" value={ORIGIN_LABELS[opportunity.origin]} />
              <Field
                label="Previsão de fechamento"
                value={opportunity.expectedCloseAt ? formatDate(opportunity.expectedCloseAt) : "—"}
              />
              <Field label="Última interação" value={formatDateTime(opportunity.lastInteractionAt)} />
              {opportunity.sourceLead && (
                <Field
                  label="Lead de origem"
                  value={opportunity.sourceLead.name}
                  href={`/crm/leads/${opportunity.sourceLead.id}`}
                />
              )}
              {opportunity.status === "LOST" && (
                <Field label="Data da perda" value={formatDateTime(opportunity.lostAt)} />
              )}
              {opportunity.status === "WON" && (
                <Field label="Data do fechamento" value={formatDateTime(opportunity.wonAt)} />
              )}
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{opportunity.description || "—"}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{opportunity.notes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <TemperatureSignalsCard
            entityKind="opportunity"
            entityId={opportunity.id}
            temperature={opportunity.temperature}
            score={opportunity.temperatureScore}
            override={opportunity.temperatureOverride}
            signals={{
              pedeProposta: opportunity.signalPedeProposta,
              perguntouPreco: opportunity.signalPerguntouPreco,
              pedeDemo: opportunity.signalPedeDemo,
              informouPrazo: opportunity.signalInformouPrazo,
              problemaUrgente: opportunity.signalProblemaUrgente,
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
                entityType="Opportunity"
                entityId={opportunity.id}
                assignableUsers={assignableUsers}
                canManage={canEdit}
              />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Próximas fases: Proposta e Atendimento chegam em fases futuras.
          </p>
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <OpportunityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {href ? (
        <Link href={href} className="mt-1 block text-primary hover:underline">
          {value}
        </Link>
      ) : (
        <p className="mt-1">{value}</p>
      )}
    </div>
  );
}

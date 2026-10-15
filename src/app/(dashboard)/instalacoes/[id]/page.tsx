import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { formatDateTime } from "@/lib/format";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { InstallationChecklist } from "@/features/installations/installation-checklist";
import { InstallationDetailActions } from "@/features/installations/installation-detail-actions";
import { InstallationTimeline } from "@/features/installations/installation-timeline";
import {
  INSTALLATION_STATUS_LABELS,
  INSTALLATION_STATUS_TONE,
} from "@/features/installations/labels";
import { canEditInstallation } from "@/features/installations/permissions";
import { isInstallationOverdue } from "@/features/installations/types";
import {
  getInstallation,
  getInstallationActivities,
  listInstallationAssignableUsers,
} from "@/features/installations/queries";
import { getTasksForEntity } from "@/features/tasks/queries";
import { TaskList } from "@/features/tasks/task-list";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function InstallationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "instalacoes", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de Instalações."
      />
    );
  }

  const { id } = await params;
  const installation = await getInstallation(id);
  if (!installation) notFound();

  const canEdit = canEditInstallation(session.user.role, session.user.id, installation);
  if (!canEdit) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Esta instalação pertence a outro responsável."
      />
    );
  }

  const [assignableUsers, activities, tasks, atendimentoAssignableUsers] = await Promise.all([
    listInstallationAssignableUsers(),
    getInstallationActivities(installation.id),
    getTasksForEntity("Installation", installation.id),
    listAtendimentoAssignableUsers(),
  ]);

  const overdue = isInstallationOverdue(installation);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/instalacoes"
        backLabel="Instalações"
        title={
          <>
            {getCustomerDisplayName(installation.customer)}
            <Badge variant="outline">{installation.stage.name}</Badge>
            <StatusBadge
              label={INSTALLATION_STATUS_LABELS[installation.status]}
              tone={INSTALLATION_STATUS_TONE[installation.status]}
            />
            <PriorityBadge priority={installation.priority} />
            {overdue && <StatusBadge label="Atrasada" tone="destructive" solid />}
          </>
        }
        description={installation.responsible?.name ?? "Sem responsável"}
        action={
          <InstallationDetailActions
            installation={installation}
            assignableUsers={assignableUsers}
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
              <Field
                label="Venda"
                value={`#${installation.sale.id.slice(-6).toUpperCase()}`}
                href={`/vendas/${installation.sale.id}`}
              />
              {installation.opportunity && (
                <Field
                  label="Oportunidade"
                  value={installation.opportunity.title}
                  href={`/crm/oportunidades/${installation.opportunity.id}`}
                />
              )}
              {installation.sale.owner && <Field label="Vendedor" value={installation.sale.owner.name} />}
              <Field label="Agendada para" value={formatDateTime(installation.scheduledAt)} />
              <Field label="Iniciada em" value={formatDateTime(installation.startedAt)} />
              <Field label="Concluída em" value={formatDateTime(installation.completedAt)} />
              <Field label="Prazo" value={formatDateTime(installation.dueAt)} />
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{installation.notes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <InstallationChecklist
                installationId={installation.id}
                items={installation.checklistItems}
                canManage={canEdit}
              />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList
                tasks={tasks}
                entityType="Installation"
                entityId={installation.id}
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
            <InstallationTimeline activities={activities} />
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

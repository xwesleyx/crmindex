import { redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, DatabaseBackup, FolderOpen, ShieldAlert, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { BackupList, RunBackupButton } from "@/features/backup/backup-list";
import { BackupSettingsForm } from "@/features/backup/backup-settings-form";
import { canRestoreHere, listBackups } from "@/features/backup/service";
import { defaultBackupDir, getBackupSettings, getBackupStatus, resolveBackupDir } from "@/features/backup/settings";
import { resolveMediaDir } from "@/features/cleanup/media-dir";

export default async function BackupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem configurar o backup."
      />
    );
  }

  const [settings, status] = await Promise.all([getBackupSettings(), getBackupStatus()]);
  const dir = resolveBackupDir(settings);
  const backups = await listBackups(dir);
  const canRestore = canRestoreHere();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Backup"
        tabs={<SettingsTabs group="backup" />}
        description="Cópias de segurança do banco de dados do CRM (clientes, conversas, tarefas, configurações...). Feitas sem parar o sistema."
        action={<RunBackupButton />}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusTile
          icon={status.lastStatus === "error" ? XCircle : CheckCircle2}
          tone={status.lastStatus === "error" ? "text-destructive" : status.lastStatus === "ok" ? "text-success" : "text-muted-foreground"}
          label="Último backup"
          value={status.lastRunAt ? formatDateTime(status.lastRunAt) : "Nenhum ainda"}
          detail={status.lastMessage ?? undefined}
        />
        <StatusTile
          icon={CalendarClock}
          tone={settings.enabled ? "text-primary" : "text-muted-foreground"}
          label="Automático"
          value={settings.enabled ? `Ligado · ${settings.time}` : "Desligado"}
          detail={settings.enabled ? `Guarda os últimos ${settings.keep}` : "Só backup manual"}
        />
        <StatusTile
          icon={FolderOpen}
          tone="text-muted-foreground"
          label="Pasta"
          value={`${backups.length} backup(s)`}
          detail={dir}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BackupSettingsForm
              settings={settings}
              defaultDir={defaultBackupDir()}
              mediaAvailable={resolveMediaDir() !== null}
            />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="size-4" />
              Backups salvos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <BackupList backups={backups} canRestore={canRestore} />
            {!canRestore && backups.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Restaurar pela tela só funciona no CRM instalado pelo instalador.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: typeof CheckCircle2;
  tone: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
        {detail && (
          <p className="truncate text-xs text-muted-foreground" title={detail}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

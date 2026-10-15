"use client";

import { DatabaseBackup, Download, History, Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";
import { formatDateTime } from "@/lib/format";
import { deleteBackup, restoreBackup, runBackupNow } from "@/features/backup/actions";
import type { BackupFile } from "@/features/backup/service";

export function RunBackupButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await runBackupNow();
          if (result.success) toast.success("Backup feito.", { description: result.message, duration: 6000 });
          else toast.error("O backup falhou", { description: result.error, duration: 10000 });
        })
      }
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
      {isPending ? "Fazendo backup..." : "Fazer backup agora"}
    </Button>
  );
}

export function BackupList({ backups, canRestore }: { backups: BackupFile[]; canRestore: boolean }) {
  if (backups.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum backup nesta pasta ainda.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {backups.map((backup, index) => (
        <li key={backup.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              {formatDateTime(backup.createdAt)}
              {index === 0 && (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                  mais recente
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {backup.name} · {formatBytes(backup.size)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`/api/backup/${encodeURIComponent(backup.name)}`} download />}
            >
              <Download className="size-3.5" />
              Baixar
            </Button>
            {canRestore && (
              <ConfirmAction
                trigger={
                  <Button variant="outline" size="sm">
                    <History className="size-3.5" />
                    Restaurar
                  </Button>
                }
                title="Restaurar este backup?"
                description={
                  <>
                    <p>
                      O CRM volta a ficar exatamente como estava em <strong>{formatDateTime(backup.createdAt)}</strong>.
                      Tudo o que foi feito depois disso some do sistema.
                    </p>
                    <p className="mt-2">
                      O banco atual não é perdido: fica guardado em backups\antes-de-restaurar. O CRM reinicia
                      sozinho e fica fora do ar por alguns segundos para todos os usuários.
                    </p>
                  </>
                }
                confirmLabel="Restaurar e reiniciar"
                destructive
                onConfirm={async () => {
                  const result = await restoreBackup(backup.name);
                  if (!result.success) {
                    toast.error("Não foi possível restaurar", { description: result.error });
                    return;
                  }
                  toast.success("Restaurando...", {
                    description: "O CRM está reiniciando. A página recarrega sozinha em alguns segundos.",
                    duration: 15000,
                  });
                  setTimeout(() => window.location.reload(), 12000);
                }}
              />
            )}
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Apagar backup">
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title="Apagar este backup?"
              description={`O arquivo ${backup.name} é apagado da pasta de backups. Não dá para desfazer.`}
              confirmLabel="Apagar"
              destructive
              onConfirm={async () => {
                const result = await deleteBackup(backup.name);
                if (result.success) toast.success("Backup apagado.");
                else toast.error(result.error);
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

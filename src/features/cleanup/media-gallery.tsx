"use client";

import Link from "next/link";
import { ExternalLink, FileText, Film, ImageOff, Music, Sticker, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/format-bytes";
import { formatDateTime } from "@/lib/format";
import { deleteFilteredMedia, deleteSelectedMedia } from "@/features/cleanup/actions";
import { MEDIA_KIND_LABELS } from "@/features/cleanup/kinds";
import type { MediaFile, MediaFilter } from "@/features/cleanup/service";

const mediaSrc = (name: string) => `/api/atendimento/media/${name}`;

const KIND_ICON = { VIDEO: Film, AUDIO: Music, DOCUMENT: FileText, STICKER: Sticker, IMAGE: ImageOff };

export function MediaGallery({
  files,
  filter,
  filteredCount,
  filteredBytes,
  backupFirstDefault,
}: {
  files: MediaFile[];
  filter: MediaFilter;
  filteredCount: number;
  filteredBytes: number;
  backupFirstDefault: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaFile | null>(null);
  const [backupFirst, setBackupFirst] = useState(backupFirstDefault);

  // Seleção só do que ainda está na tela (depois de apagar/trocar de página).
  const visibleSelected = useMemo(() => files.filter((file) => selected.has(file.name)), [files, selected]);
  const selectedBytes = visibleSelected.reduce((sum, file) => sum + file.size, 0);
  const allOnPage = files.length > 0 && visibleSelected.length === files.length;

  function toggle(name: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function report(result: { success: true; message?: string } | { success: false; error: string }) {
    if (result.success) {
      toast.success("Limpeza feita.", { description: result.message, duration: 8000 });
      setSelected(new Set());
    } else {
      toast.error("Não foi possível apagar", { description: result.error, duration: 8000 });
    }
  }

  const backupNote = backupFirst
    ? "Antes de apagar, cada arquivo é copiado para a subpasta \"midias\" do Backup."
    : "Sem cópia: os arquivos não poderão ser recuperados pelo CRM.";

  if (filteredCount === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma mídia com esses filtros.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-muted/60 px-3 py-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allOnPage}
            indeterminate={visibleSelected.length > 0 && !allOnPage}
            onCheckedChange={(checked) => setSelected(checked ? new Set(files.map((file) => file.name)) : new Set())}
          />
          Selecionar página
        </label>
        <span className="text-sm text-muted-foreground">
          {visibleSelected.length > 0
            ? `${visibleSelected.length} selecionada(s) · ${formatBytes(selectedBytes)}`
            : `${filteredCount} no filtro · ${formatBytes(filteredBytes)}`}
        </span>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={backupFirst} onCheckedChange={(checked) => setBackupFirst(Boolean(checked))} />
          Copiar para o backup antes
        </label>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {visibleSelected.length > 0 && (
            <ConfirmAction
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-3.5" />
                  Apagar selecionadas
                </Button>
              }
              title={`Apagar ${visibleSelected.length} mídia(s)?`}
              description={`Libera ${formatBytes(selectedBytes)}. As mensagens continuam no atendimento, mas sem o arquivo. ${backupNote}`}
              confirmLabel="Apagar"
              destructive
              onConfirm={async () =>
                report(
                  await deleteSelectedMedia(
                    visibleSelected.map((file) => file.name),
                    backupFirst
                  )
                )
              }
            />
          )}
          <ConfirmAction
            trigger={
              <Button variant="outline" size="sm">
                <Trash2 className="size-3.5" />
                Apagar todas do filtro
              </Button>
            }
            title={`Apagar todas as ${filteredCount} mídia(s) deste filtro?`}
            description={`Inclui as das outras páginas — libera ${formatBytes(filteredBytes)}. As mensagens continuam no atendimento, mas sem o arquivo. ${backupNote}`}
            confirmLabel={`Apagar ${filteredCount}`}
            destructive
            onConfirm={async () => report(await deleteFilteredMedia(filter, backupFirst))}
          />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {files.map((file) => {
          const isSelected = selected.has(file.name);
          const Icon = KIND_ICON[file.kind];
          const showsImage = file.kind === "IMAGE" || file.kind === "STICKER";
          return (
            <li
              key={file.name}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 transition-shadow",
                isSelected && "ring-2 ring-primary"
              )}
            >
              <button
                type="button"
                onClick={() => setPreview(file)}
                className="relative flex aspect-square items-center justify-center bg-muted"
                aria-label={`Ver ${MEDIA_KIND_LABELS[file.kind]}`}
              >
                {showsImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaSrc(file.name)}
                    alt=""
                    loading="lazy"
                    className={cn("size-full", file.kind === "STICKER" ? "object-contain p-2" : "object-cover")}
                  />
                ) : (
                  <Icon className="size-8 text-muted-foreground" />
                )}
                <span className="absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {formatBytes(file.size)}
                </span>
              </button>
              <div className="absolute top-1.5 left-1.5 rounded bg-background/90 p-0.5">
                <Checkbox checked={isSelected} onCheckedChange={() => toggle(file.name)} aria-label="Selecionar" />
              </div>
              <div className="flex min-w-0 flex-col px-2 py-1.5">
                <span className="truncate text-xs font-medium" title={file.contactName ?? undefined}>
                  {file.contactName ?? "Sem conversa"}
                </span>
                <span className="text-[10px] text-muted-foreground">{formatDateTime(file.date)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-2xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {MEDIA_KIND_LABELS[preview.kind]} · {formatBytes(preview.size)}
                </DialogTitle>
              </DialogHeader>
              <div className="flex max-h-[65vh] items-center justify-center overflow-hidden rounded-lg bg-muted">
                {preview.kind === "IMAGE" || preview.kind === "STICKER" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc(preview.name)} alt="" className="max-h-[65vh] object-contain" />
                ) : preview.kind === "VIDEO" ? (
                  <video src={mediaSrc(preview.name)} controls className="max-h-[65vh] w-full" />
                ) : preview.kind === "AUDIO" ? (
                  <audio src={mediaSrc(preview.name)} controls className="m-8 w-full max-w-md" />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-10">
                    <FileText className="size-10 text-muted-foreground" />
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<a href={mediaSrc(preview.name)} target="_blank" rel="noopener noreferrer" />}
                    >
                      <ExternalLink className="size-3.5" />
                      Abrir documento
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {preview.contactName ?? "Sem conversa ligada"} ·{" "}
                  {preview.direction === "OUTBOUND" ? "enviada" : preview.direction === "INBOUND" ? "recebida" : ""} em{" "}
                  {formatDateTime(preview.date)}
                </span>
                {preview.conversationId && (
                  <Link href={`/atendimento/${preview.conversationId}`} className="text-primary hover:underline">
                    Abrir conversa
                  </Link>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

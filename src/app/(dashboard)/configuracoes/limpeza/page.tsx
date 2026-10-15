import { redirect } from "next/navigation";
import { CalendarClock, HardDrive, Images, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { DataTablePagination } from "@/components/data-table-pagination";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBytes } from "@/lib/format-bytes";
import { formatDateTime } from "@/lib/format";
import { CleanupSettingsForm } from "@/features/cleanup/cleanup-settings-form";
import { MediaFilters } from "@/features/cleanup/media-filters";
import { MediaGallery } from "@/features/cleanup/media-gallery";
import { resolveMediaDir } from "@/features/cleanup/media-dir";
import { filterMedia, listMediaFiles } from "@/features/cleanup/service";
import {
  MEDIA_KINDS,
  MEDIA_KIND_LABELS,
  getCleanupSettings,
  getCleanupStatus,
  type MediaKind,
} from "@/features/cleanup/settings";

const PAGE_SIZE = 48;

type SearchParams = {
  tipo?: string;
  meses?: string;
  ordem?: string;
  contato?: string;
  page?: string;
};

export default async function LimpezaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem fazer a limpeza de mídias."
      />
    );
  }

  const params = await searchParams;
  const kinds = (params.tipo
    ?.split(",")
    .filter((kind) => (MEDIA_KINDS as readonly string[]).includes(kind)) ??
    []) as MediaKind[];
  const filter = {
    kinds: kinds.length > 0 ? kinds : [...MEDIA_KINDS],
    olderThanMonths: Math.max(0, Math.min(120, Number(params.meses) || 0)),
    contactId: params.contato || null,
  };
  const order =
    params.ordem === "maiores" || params.ordem === "antigas"
      ? params.ordem
      : "recentes";
  const page = Math.max(1, Number(params.page) || 1);

  const [allFiles, settings, status, contactRow] = await Promise.all([
    listMediaFiles(),
    getCleanupSettings(),
    getCleanupStatus(),
    filter.contactId
      ? prisma.contact.findUnique({
          where: { id: filter.contactId },
          select: { id: true, name: true, phone: true, whatsapp: true },
        })
      : null,
  ]);
  const selectedContact = contactRow
    ? {
        id: contactRow.id,
        name: contactRow.name,
        phone: contactRow.whatsapp ?? contactRow.phone,
      }
    : null;
  const mediaDir = resolveMediaDir();

  const filtered = filterMedia(allFiles, filter).sort((a, b) =>
    order === "maiores"
      ? b.size - a.size
      : order === "antigas"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date),
  );
  const pageFiles = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredBytes = filtered.reduce((sum, file) => sum + file.size, 0);

  const totals = MEDIA_KINDS.map((kind) => {
    const ofKind = allFiles.filter((file) => file.kind === kind);
    return {
      kind,
      count: ofKind.length,
      bytes: ofKind.reduce((sum, file) => sum + file.size, 0),
    };
  });
  const totalBytes = totals.reduce((sum, total) => sum + total.bytes, 0);

  // Prévia da limpeza programada com a regra salva.
  const scheduledPreview = filterMedia(allFiles, {
    kinds: settings.kinds,
    olderThanMonths: settings.months,
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Backup"
        tabs={<SettingsTabs group="backup" />}
        description="Fotos, vídeos, áudios e documentos do WhatsApp guardados neste computador. Veja o que ocupa espaço, apague o que não precisa ou programe a limpeza automática."
      />

      {!mediaDir ? (
        <EmptyState
          icon={HardDrive}
          title="Pasta de mídias não encontrada"
          description="O serviço do WhatsApp ainda não salvou nenhuma mídia neste computador."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="col-span-2 flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:col-span-1">
              <HardDrive className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-semibold">
                  {formatBytes(totalBytes)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {allFiles.length} arquivo(s)
                </p>
              </div>
            </div>
            {totals.map((total) => (
              <div
                key={total.kind}
                className="rounded-xl bg-card p-3 ring-1 ring-foreground/10"
              >
                <p className="text-xs text-muted-foreground">
                  {MEDIA_KIND_LABELS[total.kind]}
                </p>
                <p className="text-sm font-semibold">
                  {formatBytes(total.bytes)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {total.count} arquivo(s)
                </p>
              </div>
            ))}
          </div>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4" />
                Limpeza programada
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <CleanupSettingsForm settings={settings} />
              <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Com a regra salva, hoje seriam apagados{" "}
                <strong className="text-foreground">
                  {scheduledPreview.length} arquivo(s) (
                  {formatBytes(
                    scheduledPreview.reduce((sum, file) => sum + file.size, 0),
                  )}
                  )
                </strong>
                .
                {status.lastRunAt && (
                  <>
                    {" "}
                    Última limpeza: {formatDateTime(status.lastRunAt)} —{" "}
                    {status.lastMessage}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Images className="size-4" />
                Mídias
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <MediaFilters
                kinds={kinds}
                months={filter.olderThanMonths}
                order={order}
                contact={selectedContact}
              />
              <MediaGallery
                files={pageFiles}
                filter={filter}
                filteredCount={filtered.length}
                filteredBytes={filteredBytes}
                backupFirstDefault={settings.backupFirst}
              />
              <DataTablePagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                basePath="/configuracoes/limpeza"
                searchParams={{
                  tipo: params.tipo,
                  meses: params.meses,
                  ordem: params.ordem,
                  contato: params.contato,
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

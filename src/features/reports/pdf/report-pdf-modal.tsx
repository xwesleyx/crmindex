"use client";

import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReportPdfDocument } from "@/features/reports/pdf/report-document";

// Só é importado via next/dynamic(..., { ssr: false }) em report-pdf-button.tsx
// — PDFViewer/PDFDownloadLink acessam APIs de navegador (iframe, Blob), não
// podem ser renderizados no servidor.
export function ReportPdfModal({
  title,
  subtitle,
  columns,
  rows,
  fileName,
  onClose,
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  fileName: string;
  onClose: () => void;
}) {
  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  const document = (
    <ReportPdfDocument title={title} subtitle={subtitle} columns={columns} rows={rows} generatedAt={generatedAt} />
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: "none" }}>
            {document}
          </PDFViewer>
        </div>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Pra mandar pelo WhatsApp Web: baixe o PDF e anexe manualmente na conversa — o navegador não deixa
            uma página anexar arquivo direto em outra.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href="https://web.whatsapp.com" target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Abrir WhatsApp Web
            </Button>
            <PDFDownloadLink document={document} fileName={fileName}>
              {({ loading }) => <Button size="sm" disabled={loading}>{loading ? "Gerando..." : "Baixar PDF"}</Button>}
            </PDFDownloadLink>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

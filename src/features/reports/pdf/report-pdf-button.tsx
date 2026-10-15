"use client";

import { FileDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// PDFViewer/PDFDownloadLink (@react-pdf/renderer) usam iframe/Blob — só
// existem no navegador, por isso ssr:false (evita quebrar a renderização no
// servidor).
const ReportPdfModal = dynamic(
  () => import("@/features/reports/pdf/report-pdf-modal").then((m) => m.ReportPdfModal),
  { ssr: false }
);

export function ReportPdfButton({
  title,
  subtitle,
  columns,
  rows,
  fileName,
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  fileName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={rows.length === 0}>
        <FileDown className="size-4" />
        Exportar PDF
      </Button>
      {open && (
        <ReportPdfModal
          title={title}
          subtitle={subtitle}
          columns={columns}
          rows={rows}
          fileName={fileName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

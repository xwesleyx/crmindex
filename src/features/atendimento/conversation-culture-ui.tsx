"use client";

import Link from "next/link";
import { AlertTriangle, NotebookPen, Pencil } from "lucide-react";
import { useState, type ReactElement } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { CultureViewer } from "@/features/customers/culture/culture-viewer";
import type { CustomerCulture } from "@/features/customers/culture/queries";

// Pop-up com o documento Cultura/Modelo do cliente, aberto de dentro da
// conversa (faixa do chat ou painel lateral).
export function CultureDialog({
  culture,
  customerName,
  trigger,
}: {
  culture: CustomerCulture;
  customerName: string;
  trigger: (open: () => void) => ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <NotebookPen className="size-4" />
              Cultura/Modelo — {customerName}
            </DialogTitle>
            {culture.updatedAt && (
              <p className="text-xs text-muted-foreground">
                Atualizado {culture.updatedByName ? `por ${culture.updatedByName} ` : ""}em{" "}
                {formatDateTime(culture.updatedAt)}
              </p>
            )}
          </DialogHeader>
          {culture.alert && <AlertLine text={culture.alert} />}
          <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
            {culture.content ? (
              <CultureViewer content={culture.content} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento escrito ainda.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/clientes/${culture.customerId}?aba=cultura`} />}
            >
              <Pencil className="size-3.5" />
              Editar na ficha do cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AlertLine({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="min-w-0">{text}</span>
    </div>
  );
}

// Faixa logo abaixo do cabeçalho do chat: o aviso em destaque (se houver)
// e o atalho pro documento. Nada aparece se o cliente não tem nenhum dos dois.
export function CultureStrip({ culture, customerName }: { culture: CustomerCulture | null; customerName: string }) {
  if (!culture || (!culture.alert && !culture.content)) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-3 py-1.5 text-xs",
        culture.alert
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      {culture.alert ? (
        <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      ) : (
        <NotebookPen className="size-3.5 shrink-0" />
      )}
      <span className={cn("min-w-0 flex-1 truncate", culture.alert && "font-medium text-foreground")} title={culture.alert ?? undefined}>
        {culture.alert ?? "Este cliente tem orientações em Cultura/Modelo."}
      </span>
      <CultureDialog
        culture={culture}
        customerName={customerName}
        trigger={(open) => (
          <button type="button" onClick={open} className="shrink-0 font-medium text-primary hover:underline">
            Ver Cultura/Modelo
          </button>
        )}
      />
    </div>
  );
}

// Bloco no painel lateral da conversa.
export function CultureSection({ culture, customerName }: { culture: CustomerCulture; customerName: string }) {
  const empty = !culture.alert && !culture.content;
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase">Cultura/Modelo</h3>
      {empty ? (
        <Link
          href={`/clientes/${culture.customerId}?aba=cultura`}
          className="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Nada registrado sobre como este cliente funciona. Escrever na ficha do cliente →
        </Link>
      ) : (
        <div className="flex flex-col gap-2">
          {culture.alert && <AlertLine text={culture.alert} className="text-xs" />}
          <CultureDialog
            culture={culture}
            customerName={customerName}
            trigger={(open) => (
              <Button variant="outline" size="sm" onClick={open} className="w-full">
                <NotebookPen className="size-3.5" />
                {culture.content ? "Abrir Cultura/Modelo" : "Ver detalhes"}
              </Button>
            )}
          />
        </div>
      )}
    </section>
  );
}

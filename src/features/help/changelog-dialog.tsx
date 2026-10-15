"use client";

import type { ReactElement } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CHANGELOG } from "@/lib/changelog";
import { formatDate } from "@/lib/format";

// Fora do fluxo de leitura da página (era uma seção lá embaixo, no meio de
// tudo) — agora é só um pop-up, pra quem quer ver rápido "o que mudou" sem
// rolar a Central de Ajuda inteira.
export function ChangelogDialog({ trigger }: { trigger: ReactElement }) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de versões</DialogTitle>
        </DialogHeader>
        <ol className="flex flex-col gap-4">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/10">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                  v{entry.version}
                </span>
                <span className="text-sm font-medium text-foreground">{entry.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
              </div>
              <ul className="flex flex-col gap-1 pl-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/85">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

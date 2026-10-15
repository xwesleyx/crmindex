"use client";

import { Download, Sparkles, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requestUpdateNow } from "@/features/license/actions";
import type { ControlVersion } from "@/features/license/control";

const dismissKey = (version: string) => `crm.update.dismissed.${version}`;

function readDismissed(version: string): boolean {
  try {
    return window.localStorage.getItem(dismissKey(version)) === "1";
  } catch {
    return false;
  }
}

// Aviso de versão nova para administradores: "Atualizar agora" ou
// "Depois" (some até a próxima versão; volta a aparecer ao recarregar se
// a versão for obrigatória — essa o atualizador instala sozinho).
export function UpdateBanner({
  latest,
  currentVersion,
  canUpdate,
}: {
  latest: ControlVersion;
  currentVersion: string;
  canUpdate: boolean;
}) {
  const dismissedStored = useSyncExternalStore(
    () => () => {},
    () => readDismissed(latest.numero),
    () => false
  );
  const [dismissed, setDismissed] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  if (!latest.forcar && (dismissed || dismissedStored)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(dismissKey(latest.numero), "1");
    } catch {
      // sem armazenamento: some só nesta tela
    }
    setDismissed(true);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm">
      <Sparkles className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <strong>Nova versão {latest.numero} disponível</strong>
        <span className="text-muted-foreground">
          {" "}
          (você está na {currentVersion})
          {latest.forcar ? " — atualização obrigatória: será instalada automaticamente em instantes." : ""}
        </span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setNotesOpen(true)}>
          Ver novidades
        </Button>
        {canUpdate && (
          <ConfirmAction
            trigger={
              <Button size="sm">
                <Download className="size-3.5" />
                Atualizar agora
              </Button>
            }
            title={`Atualizar para a versão ${latest.numero}?`}
            description="O sistema fica fora do ar por alguns minutos para todos os usuários enquanto instala. As telas mostram o aviso de atualização e voltam sozinhas quando terminar. Um backup do banco é feito antes."
            confirmLabel="Atualizar agora"
            onConfirm={async () => {
              const result = await requestUpdateNow();
              if (result.success) {
                toast.success("Atualização iniciada", {
                  description: "Em até um minuto o sistema começa a baixar a versão nova.",
                  duration: 10000,
                });
              } else {
                toast.error("Não foi possível atualizar", { description: result.error });
              }
            }}
          />
        )}
        {!latest.forcar && (
          <Button variant="ghost" size="icon-sm" aria-label="Depois" title="Depois" onClick={dismiss}>
            <X className="size-4" />
          </Button>
        )}
      </div>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Versão {latest.numero}
              {latest.titulo ? ` — ${latest.titulo}` : ""}
            </DialogTitle>
          </DialogHeader>
          {latest.novidades && latest.novidades.length > 0 ? (
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {latest.novidades.map((item, index) => (
                <li key={index} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem descrição das novidades.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

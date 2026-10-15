"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ContactCandidate = {
  id: string;
  name: string;
  role: string | null;
  companyName: string | null;
};

// "Encontramos possíveis correspondências" (seção 7) — reaproveitado tanto
// pela resolução de número desconhecido/ambíguo no atendimento quanto pelo
// fluxo de iniciar atendimento pelo Kanban quando a empresa tem mais de um
// contato e nenhum principal definido.
export function ContactDisambiguationDialog({
  open,
  onOpenChange,
  candidates,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: ContactCandidate[];
  onSelect: (contactId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Encontramos possíveis correspondências</DialogTitle>
          <DialogDescription>Selecione a pessoa correta para continuar.</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => onSelect(candidate.id)}
                className="flex w-full flex-col items-start rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{candidate.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[candidate.companyName, candidate.role].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

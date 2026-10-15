"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// "Este contato já possui um atendimento em andamento" (seções 15/16) — o
// mesmo clique em 💬 que iniciaria uma conversa nova cai aqui quando já
// existe uma ativa, cobrindo abrir/transferir num único lugar (documentado
// no plano desta etapa em vez de um botão "Transferir" separado no card).
export function ActiveConversationDialog({
  open,
  onOpenChange,
  conversationId,
  onTransferToMyQueue,
  onTransferToMe,
  showTransferToQueue,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onTransferToMyQueue: () => void;
  onTransferToMe: () => void;
  showTransferToQueue: boolean;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Atendimento em andamento</DialogTitle>
          <DialogDescription>Este contato já possui um atendimento em andamento.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:flex-col">
          <Button
            nativeButton={false}
            render={<Link href={`/atendimento/${conversationId}`}>Abrir atendimento</Link>}
            className="w-full"
          />
          {showTransferToQueue && (
            <Button
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={onTransferToMyQueue}
            >
              Transferir para minha fila
            </Button>
          )}
          <Button variant="outline" className="w-full" disabled={pending} onClick={onTransferToMe}>
            Transferir para mim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

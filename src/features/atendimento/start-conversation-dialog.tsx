"use client";

import { ConversationQueue } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { startConversationFromEntity, type AtendimentoEntityType } from "@/features/atendimento/actions";
import { CONVERSATION_QUEUE_LABELS } from "@/features/atendimento/labels";
import type { AssignableUser } from "@/features/leads/types";

export type ReadyToStart = {
  contact: { id: string; name: string; role: string | null };
  companyName: string | null;
};

// "Iniciar atendimento" (seção 11) — aberto depois que o contato já foi
// resolvido sem ambiguidade (resolveConversationForEntity → "ready").
// Contato/empresa somente-leitura (vêm de onde o clique partiu, não dá pra
// trocar aqui); Fila/Atendente/mensagem inicial são as únicas escolhas.
export function StartConversationDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  data,
  defaultQueue,
  assignableUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: AtendimentoEntityType;
  entityId: string;
  data: ReadyToStart | null;
  defaultQueue?: ConversationQueue;
  assignableUsers: AssignableUser[];
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<ConversationQueue | "none">(defaultQueue ?? "none");
  const [assigneeMode, setAssigneeMode] = useState<"unassigned" | "me" | "user">("me");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!data) return null;

  async function handleSubmit() {
    if (!data) return;
    setSubmitting(true);
    const result = await startConversationFromEntity({
      entityType,
      entityId,
      contactId: data.contact.id,
      queue: queue === "none" ? undefined : queue,
      assigneeMode,
      assigneeUserId: assigneeMode === "user" ? assigneeUserId || undefined : undefined,
      initialMessage: message.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Atendimento iniciado.");
    onOpenChange(false);
    router.push(`/atendimento/${result.data.conversationId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar atendimento</DialogTitle>
          <DialogDescription>
            {data.contact.name}
            {data.contact.role ? ` · ${data.contact.role}` : ""}
            {data.companyName ? ` · ${data.companyName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Fila</Label>
              <Select value={queue} onValueChange={(v) => setQueue(v as ConversationQueue | "none")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem fila</SelectItem>
                  {Object.values(ConversationQueue).map((q) => (
                    <SelectItem key={q} value={q}>
                      {CONVERSATION_QUEUE_LABELS[q]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Atendente</Label>
              <Select
                value={assigneeMode === "user" ? assigneeUserId || "user" : assigneeMode}
                onValueChange={(v) => {
                  if (!v) return;
                  if (v === "unassigned" || v === "me") {
                    setAssigneeMode(v);
                    return;
                  }
                  setAssigneeMode("user");
                  setAssigneeUserId(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  <SelectItem value="me">Eu</SelectItem>
                  {assignableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start-conversation-message">Mensagem inicial (opcional)</Label>
            <Textarea
              id="start-conversation-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Olá! Tudo bem?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Iniciando..." : "Iniciar atendimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteQuickReply } from "@/features/quick-replies/actions";
import { QuickReplyFormDialog } from "@/features/quick-replies/quick-reply-form-dialog";
import type { QuickReplyListItem } from "@/features/quick-replies/queries";

export function QuickReplyList({ items }: { items: QuickReplyListItem[] }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <QuickReplyRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function QuickReplyRow({ item }: { item: QuickReplyListItem }) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteQuickReply(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Resposta rápida removida.");
      setDeleteOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-20 shrink-0 rounded-md bg-muted px-2 py-1 text-center text-xs font-medium">
        /{item.shortcut}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{item.message}</p>

      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)} aria-label="Editar">
          <Pencil className="size-3.5" />
        </Button>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover a resposta rápida &quot;/{item.shortcut}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>Ela deixa de aparecer pra todo mundo ao digitar &quot;/&quot; no Atendimento.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={isPending} onClick={handleDelete}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <QuickReplyFormDialog mode="edit" item={item} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteChecklistTemplateItem,
  moveChecklistTemplateItem,
} from "@/features/checklist-templates/actions";
import { ChecklistTemplateItemDialog } from "@/features/checklist-templates/checklist-template-item-dialog";
import type { ChecklistTemplateItemListItem } from "@/features/checklist-templates/queries";

export function ChecklistTemplateList({ items }: { items: ChecklistTemplateItemListItem[] }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {items.map((item, index) => (
        <ChecklistTemplateRow
          key={item.id}
          item={item}
          isFirst={index === 0}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
}

function ChecklistTemplateRow({
  item,
  isFirst,
  isLast,
}: {
  item: ChecklistTemplateItemListItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveChecklistTemplateItem(item.id, direction);
      if (!result.success) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteChecklistTemplateItem(item.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Item removido do checklist padrão.");
      setDeleteOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isFirst || isPending}
          onClick={() => handleMove("up")}
          aria-label="Mover para cima"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={isLast || isPending}
          onClick={() => handleMove("down")}
          aria-label="Mover para baixo"
        >
          <ArrowDown className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm">{item.label}</span>
        {item.required && (
          <Badge variant="outline" className="w-fit text-[10px]">
            Obrigatório
          </Badge>
        )}
      </div>

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
              <AlertDialogTitle>Remover item do checklist padrão?</AlertDialogTitle>
              <AlertDialogDescription>
                Instalações já criadas não são afetadas — isso só muda o que instalações NOVAS
                vão receber a partir de agora.
              </AlertDialogDescription>
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

      <ChecklistTemplateItemDialog mode="edit" item={item} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

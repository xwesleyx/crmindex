"use client";

import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
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
import { PROTECTED_STAGE_KEYS } from "@/features/kanban/constants";
import { moveKanbanStage, toggleKanbanStageArchived } from "@/features/kanban-stages/actions";
import { KanbanStageFormDialog } from "@/features/kanban-stages/kanban-stage-form-dialog";
import type { KanbanStageConfigItem } from "@/features/kanban-stages/queries";

export function KanbanStageList({ stages }: { stages: KanbanStageConfigItem[] }) {
  const active = stages.filter((s) => !s.deletedAt);
  const archived = stages.filter((s) => s.deletedAt);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {active.map((stage, index) => (
          <KanbanStageRow
            key={stage.id}
            stage={stage}
            isFirst={index === 0}
            isLast={index === active.length - 1}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground">
            {archived.length} etapa(s) removida(s) — clique para ver
          </summary>
          <div className="flex flex-col divide-y divide-border border-t border-border">
            {archived.map((stage) => (
              <KanbanStageRow key={stage.id} stage={stage} isFirst isLast />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function KanbanStageRow({
  stage,
  isFirst,
  isLast,
}: {
  stage: KanbanStageConfigItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archived = !!stage.deletedAt;
  const protectedStage = PROTECTED_STAGE_KEYS.includes(stage.key);

  function handleMove(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveKanbanStage(stage.id, direction);
      if (!result.success) toast.error(result.error);
    });
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleKanbanStageArchived(stage.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(archived ? "Etapa restaurada." : "Etapa removida.");
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {!archived && (
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
      )}

      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />

      {/* min-w-0 é necessário pra truncate funcionar dentro de um flex item —
          sem ele, um nome de etapa longo empurra a linha inteira pra fora da
          largura da tela em vez de cortar com reticências. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm" title={stage.name}>
          {stage.name}
        </span>
        {protectedStage && (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Usada pelo sistema
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)} aria-label="Editar">
          <Pencil className="size-3.5" />
        </Button>

        {!protectedStage && (
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger
              render={
                <Button type="button" variant={archived ? "outline" : "ghost"} size="sm">
                  {archived ? "Restaurar" : "Remover"}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{archived ? "Restaurar etapa?" : "Remover etapa?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {archived
                    ? "A etapa volta a aparecer no Kanban."
                    : "A etapa some do Kanban — só é permitido se não houver nenhum registro nela no momento. Nada é apagado de verdade, dá pra restaurar depois."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={isPending} onClick={handleToggle}>
                  {archived ? "Restaurar" : "Remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <KanbanStageFormDialog mode="edit" stage={stage} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

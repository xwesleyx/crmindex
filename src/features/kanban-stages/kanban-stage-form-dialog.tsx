"use client";

import type { KanbanBoard } from "@prisma/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactElement, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createKanbanStage, updateKanbanStage } from "@/features/kanban-stages/actions";
import type { KanbanStageConfigItem } from "@/features/kanban-stages/queries";
import { kanbanStageFormSchema, type KanbanStageFormInput } from "@/features/kanban-stages/schema";

// Mesma lógica de geração de cor sugerida de region-form-dialog.tsx.
function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 65, 50);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

type KanbanStageFormDialogBaseProps =
  | { mode: "create"; board: KanbanBoard; stage?: never }
  | { mode: "edit"; board?: never; stage: KanbanStageConfigItem };

type KanbanStageFormDialogProps = KanbanStageFormDialogBaseProps &
  (
    | { trigger: ReactElement; open?: never; onOpenChange?: never }
    | { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void }
  );

export function KanbanStageFormDialog(props: KanbanStageFormDialogProps) {
  const { mode, stage } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<KanbanStageFormInput>({
    resolver: zodResolver(kanbanStageFormSchema),
    defaultValues: { name: stage?.name ?? "", color: stage?.color ?? randomColor() },
  });

  async function onSubmit(data: KanbanStageFormInput) {
    const result =
      mode === "create" ? await createKanbanStage(props.board, data) : await updateKanbanStage(stage!.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Etapa criada." : "Etapa atualizada.");
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova etapa" : "Editar etapa"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" placeholder="Ex: Aguardando pagamento" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color">Cor</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <input
                    id="color"
                    type="color"
                    value={field.value || "#000000"}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                  />
                  <Input
                    aria-label="Código hex da cor"
                    maxLength={7}
                    className="uppercase"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </div>
              )}
            />
            {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : mode === "create" ? "Criar etapa" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

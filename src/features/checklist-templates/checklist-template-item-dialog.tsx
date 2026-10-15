"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactElement, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createChecklistTemplateItem, updateChecklistTemplateItem } from "@/features/checklist-templates/actions";
import type { ChecklistTemplateItemListItem } from "@/features/checklist-templates/queries";
import {
  checklistTemplateItemFormSchema,
  type ChecklistTemplateItemFormInput,
} from "@/features/checklist-templates/schema";

type ChecklistTemplateItemDialogBaseProps = { mode: "create" | "edit"; item?: ChecklistTemplateItemListItem };

type ChecklistTemplateItemDialogProps =
  | (ChecklistTemplateItemDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (ChecklistTemplateItemDialogBaseProps & { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void });

export function ChecklistTemplateItemDialog(props: ChecklistTemplateItemDialogProps) {
  const { mode, item } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChecklistTemplateItemFormInput>({
    resolver: zodResolver(checklistTemplateItemFormSchema),
    defaultValues: { label: item?.label ?? "", required: item?.required ?? true },
  });

  async function onSubmit(data: ChecklistTemplateItemFormInput) {
    const result =
      mode === "create" ? await createChecklistTemplateItem(data) : await updateChecklistTemplateItem(item!.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Item criado." : "Item atualizado.");
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo item do checklist" : "Editar item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Texto do item</Label>
            <Input id="label" placeholder="Ex: Configurar backup automático" {...register("label")} />
            {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="required"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id="required" />
              )}
            />
            <Label htmlFor="required" className="font-normal">
              Obrigatório (bloqueia concluir a instalação enquanto pendente)
            </Label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : mode === "create" ? "Criar item" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

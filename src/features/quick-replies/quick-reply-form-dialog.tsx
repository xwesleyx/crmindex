"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactElement, useState } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { createQuickReply, updateQuickReply } from "@/features/quick-replies/actions";
import type { QuickReplyListItem } from "@/features/quick-replies/queries";
import { quickReplyFormSchema, type QuickReplyFormInput } from "@/features/quick-replies/schema";

type QuickReplyFormDialogBaseProps = { mode: "create" | "edit"; item?: QuickReplyListItem };

type QuickReplyFormDialogProps =
  | (QuickReplyFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (QuickReplyFormDialogBaseProps & { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void });

export function QuickReplyFormDialog(props: QuickReplyFormDialogProps) {
  const { mode, item } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickReplyFormInput>({
    resolver: zodResolver(quickReplyFormSchema),
    defaultValues: { shortcut: item?.shortcut ?? "", message: item?.message ?? "" },
  });

  async function onSubmit(data: QuickReplyFormInput) {
    const result = mode === "create" ? await createQuickReply(data) : await updateQuickReply(item!.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Resposta rápida criada." : "Resposta rápida atualizada.");
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova resposta rápida" : "Editar resposta rápida"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shortcut">Atalho (depois da barra)</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">/</span>
              <Input id="shortcut" placeholder="Ex: p" {...register("shortcut")} />
            </div>
            {errors.shortcut && <p className="text-xs text-destructive">{errors.shortcut.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              rows={4}
              placeholder="Ex: Obrigado pela preferência!"
              {...register("message")}
            />
            {errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : mode === "create" ? "Criar" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

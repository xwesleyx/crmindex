"use client";

import { LossReason } from "@prisma/client";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { LOSS_REASON_LABELS } from "@/features/opportunities/labels";
import { lostReasonSchema, type LostReasonInput } from "@/features/opportunities/schema";
import { zodResolver } from "@hookform/resolvers/zod";

export function LostReasonDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: LostReasonInput) => Promise<{ success: boolean; error?: string }>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LostReasonInput>({
    resolver: zodResolver(lostReasonSchema),
    defaultValues: { reason: undefined, note: "" },
  });

  const reason = useWatch({ control, name: "reason" });

  async function onSubmit(data: LostReasonInput) {
    const result = await onConfirm(data);
    if (!result.success) {
      toast.error(result.error ?? "Não foi possível marcar como perdida.");
      return;
    }
    toast.success("Oportunidade marcada como perdida.");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como perdida</DialogTitle>
          <DialogDescription>
            Informe o motivo — a oportunidade continua no histórico, não é apagada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Motivo</Label>
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(LossReason).map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {LOSS_REASON_LABELS[reason]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>

          {reason === "OUTRO" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Descreva o motivo</Label>
              <Textarea id="note" rows={2} {...register("note")} />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Marcar como perdida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

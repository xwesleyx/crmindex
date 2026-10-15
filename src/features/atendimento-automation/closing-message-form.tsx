"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateClosingMessageSettings } from "@/features/atendimento-automation/actions";
import {
  closingMessageSettingsSchema,
  type ClosingMessageSettingsInput,
} from "@/features/atendimento-automation/schema";

export function ClosingMessageForm({ enabled, text }: { enabled: boolean; text: string }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClosingMessageSettingsInput>({
    resolver: zodResolver(closingMessageSettingsSchema),
    defaultValues: { enabled, text },
  });

  async function onSubmit(data: ClosingMessageSettingsInput) {
    const result = await updateClosingMessageSettings(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Mensagem de encerramento salva.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="closing-enabled" />
          )}
        />
        <Label htmlFor="closing-enabled" className="font-normal">
          Enviar automaticamente ao encerrar o atendimento
        </Label>
      </div>

      <Textarea
        rows={3}
        placeholder="Ex: Encerramos este atendimento por aqui. Qualquer coisa, é só chamar de novo!"
        {...register("text")}
      />
      {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}

      <Button type="submit" size="sm" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

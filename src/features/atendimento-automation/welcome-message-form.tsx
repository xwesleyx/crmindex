"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateWelcomeMessageSettings } from "@/features/atendimento-automation/actions";
import {
  welcomeMessageSettingsSchema,
  type WelcomeMessageSettingsInput,
} from "@/features/atendimento-automation/schema";

export function WelcomeMessageForm({ enabled, text }: { enabled: boolean; text: string }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<WelcomeMessageSettingsInput>({
    resolver: zodResolver(welcomeMessageSettingsSchema),
    defaultValues: { enabled, text },
  });

  async function onSubmit(data: WelcomeMessageSettingsInput) {
    const result = await updateWelcomeMessageSettings(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Mensagem de boas-vindas salva.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="welcome-enabled" />
          )}
        />
        <Label htmlFor="welcome-enabled" className="font-normal">
          Enviar automaticamente quando um contato novo chega na fila (sem nenhum atendimento em andamento)
        </Label>
      </div>

      <Textarea
        rows={3}
        placeholder="Ex: Seja bem-vindo(a) ao Suporte da Atual Soluções! Em instantes alguém vai te atender."
        {...register("text")}
      />
      {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}

      <Button type="submit" size="sm" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

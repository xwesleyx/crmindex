"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateAfterHoursSettings } from "@/features/atendimento-automation/actions";
import {
  afterHoursSettingsSchema,
  type AfterHoursSettingsInput,
} from "@/features/atendimento-automation/schema";

export function AfterHoursForm({
  enabled,
  time,
  text,
}: {
  enabled: boolean;
  time: string;
  text: string;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AfterHoursSettingsInput>({
    resolver: zodResolver(afterHoursSettingsSchema),
    defaultValues: { enabled, time, text },
  });

  async function onSubmit(data: AfterHoursSettingsInput) {
    const result = await updateAfterHoursSettings(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Mensagem de fora do horário salva.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="after-hours-enabled" />
          )}
        />
        <Label htmlFor="after-hours-enabled" className="font-normal">
          Enviar automaticamente quando o cliente mandar mensagem depois de um horário
        </Label>
      </div>

      <div className="flex flex-col gap-1.5 sm:w-40">
        <Label htmlFor="after-hours-time">A partir de que horário</Label>
        <Input id="after-hours-time" type="time" {...register("time")} />
        {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
      </div>

      <Textarea
        rows={3}
        placeholder="Ex: Estamos indisponíveis no momento, mas você pode chamar no plantão 27 3442-1080."
        {...register("text")}
      />
      {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
      <p className="text-xs text-muted-foreground">
        Manda no máximo uma vez por dia em cada conversa, mesmo que o cliente mande várias mensagens seguidas.
      </p>

      <Button type="submit" size="sm" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

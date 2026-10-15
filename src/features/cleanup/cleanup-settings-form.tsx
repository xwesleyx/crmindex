"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateCleanupSettings } from "@/features/cleanup/actions";
import type { CleanupSettingsInput } from "@/features/cleanup/schema";
import { MEDIA_KINDS, MEDIA_KIND_LABELS } from "@/features/cleanup/kinds";

export function CleanupSettingsForm({ settings }: { settings: CleanupSettingsInput }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<CleanupSettingsInput>({ defaultValues: settings });
  const enabled = useWatch({ control, name: "enabled" });

  async function onSubmit(data: CleanupSettingsInput) {
    const result = await updateCleanupSettings({ ...data, months: Number(data.months) });
    if (!result.success) {
      toast.error("Não foi possível salvar", { description: result.error });
      return;
    }
    toast.success("Limpeza salva.", {
      description: data.enabled
        ? `Todo dia às ${data.time}, apaga mídias com mais de ${data.months} mês(es).`
        : "Limpeza automática desligada.",
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => <Switch id="cleanup-enabled" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label htmlFor="cleanup-enabled" className="font-normal">
          Apagar automaticamente as mídias antigas
        </Label>
      </div>

      <fieldset disabled={!enabled} className={cn("flex flex-col gap-4", !enabled && "opacity-60")}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cleanup-months">Mais antigas que</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cleanup-months"
                type="number"
                min={1}
                max={120}
                className="w-20"
                {...register("months", { valueAsNumber: true })}
              />
              <span className="text-sm text-muted-foreground">meses</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cleanup-time">Todo dia às</Label>
            <Input id="cleanup-time" type="time" className="w-32" {...register("time")} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Tipos de mídia</Label>
          <Controller
            control={control}
            name="kinds"
            render={({ field }) => (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {MEDIA_KINDS.map((kind) => (
                  <label key={kind} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value.includes(kind)}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? [...field.value, kind] : field.value.filter((value) => value !== kind))
                      }
                    />
                    {MEDIA_KIND_LABELS[kind]}
                  </label>
                ))}
              </div>
            )}
          />
        </div>
      </fieldset>

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="backupFirst"
          render={({ field }) => (
            <Checkbox id="cleanup-backup" checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
          )}
        />
        <div>
          <Label htmlFor="cleanup-backup" className="font-normal">
            Copiar para a pasta de backup antes de apagar
          </Label>
          <p className="text-xs text-muted-foreground">
            Vale para a limpeza automática e para a manual. O arquivo sai do CRM, mas fica guardado na subpasta
            &quot;midias&quot; do Backup.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        As mensagens continuam no histórico do atendimento — só o arquivo some, e o balão avisa que a mídia foi
        removida na limpeza. Horário de Brasília; com o computador desligado no horário, roda quando o CRM ligar no
        mesmo dia.
      </p>

      <Button type="submit" size="sm" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

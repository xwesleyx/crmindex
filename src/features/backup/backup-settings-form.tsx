"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateBackupSettings } from "@/features/backup/actions";
import type { BackupSettingsInput } from "@/features/backup/schema";

const WEEKDAY_OPTIONS = [
  { value: 1, short: "Seg" },
  { value: 2, short: "Ter" },
  { value: 3, short: "Qua" },
  { value: 4, short: "Qui" },
  { value: 5, short: "Sex" },
  { value: 6, short: "Sáb" },
  { value: 0, short: "Dom" },
];

export function BackupSettingsForm({
  settings,
  defaultDir,
  mediaAvailable,
}: {
  settings: BackupSettingsInput;
  defaultDir: string;
  mediaAvailable: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting, errors },
  } = useForm<BackupSettingsInput>({ defaultValues: settings });
  const enabled = useWatch({ control, name: "enabled" });

  async function onSubmit(data: BackupSettingsInput) {
    const result = await updateBackupSettings({ ...data, keep: Number(data.keep) });
    if (!result.success) {
      toast.error("Não foi possível salvar o backup", { description: result.error, duration: 8000 });
      return;
    }
    toast.success("Backup salvo.", {
      description: data.enabled
        ? `Automático às ${data.time}${data.days.length === 7 ? ", todos os dias" : ""}, guardando os últimos ${data.keep}.`
        : "Backup automático desligado — use \"Fazer backup agora\" quando quiser.",
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => <Switch id="backup-enabled" checked={field.value} onCheckedChange={field.onChange} />}
        />
        <Label htmlFor="backup-enabled" className="font-normal">
          Fazer backup automático do banco de dados
        </Label>
      </div>

      <fieldset disabled={!enabled} className={cn("flex flex-col gap-5", !enabled && "opacity-60")}>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="backup-time">Horário</Label>
            <Input id="backup-time" type="time" className="w-32" {...register("time")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Dias</Label>
            <Controller
              control={control}
              name="days"
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = field.value.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          field.onChange(
                            active ? field.value.filter((value) => value !== day.value) : [...field.value, day.value]
                          )
                        }
                        className={cn(
                          "h-8 w-11 rounded-md border text-xs font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Horário de Brasília. Se o computador estiver desligado nesse horário, o backup é feito assim que o CRM ligar
          no mesmo dia.
        </p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="backup-dir">Pasta onde salvar</Label>
        <Input id="backup-dir" placeholder={defaultDir} {...register("dir")} />
        {errors.dir && <p className="text-xs text-destructive">{errors.dir.message}</p>}
        <p className="text-xs text-muted-foreground">
          Em branco, usa a pasta padrão ({defaultDir}). Para se proteger de defeito no computador, aponte para um HD
          externo, uma pasta da rede (ex.: \\SERVIDOR\Backups) ou uma pasta sincronizada com Google Drive/OneDrive.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="backup-keep">Quantos backups guardar</Label>
        <div className="flex items-center gap-2">
          <Input
            id="backup-keep"
            type="number"
            min={1}
            max={365}
            className="w-24"
            {...register("keep", { valueAsNumber: true })}
          />
          <span className="text-sm text-muted-foreground">mais recentes — os mais antigos são apagados</span>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name="includeMedia"
          render={({ field }) => (
            <Checkbox
              id="backup-media"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={!mediaAvailable}
              className="mt-0.5"
            />
          )}
        />
        <div>
          <Label htmlFor="backup-media" className="font-normal">
            Copiar também as mídias do WhatsApp (fotos, áudios, vídeos, documentos)
          </Label>
          <p className="text-xs text-muted-foreground">
            {mediaAvailable
              ? "Vão para a subpasta \"midias\", só as novas a cada backup. O que a Limpeza apagar do CRM continua guardado lá."
              : "Pasta de mídias do WhatsApp não encontrada neste computador."}
          </p>
        </div>
      </div>

      <Button type="submit" size="sm" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

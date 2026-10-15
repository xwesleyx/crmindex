"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateAgendaRemindersSettings } from "@/features/atendimento-automation/actions";
import type { AgendaRemindersSettingsInput } from "@/features/atendimento-automation/schema";

export function AgendaRemindersForm({
  enabled,
  dailySummaryWhatsapp,
}: {
  enabled: boolean;
  dailySummaryWhatsapp: boolean;
}) {
  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<AgendaRemindersSettingsInput>({ defaultValues: { enabled, dailySummaryWhatsapp } });

  async function onSubmit(data: AgendaRemindersSettingsInput) {
    const result = await updateAgendaRemindersSettings(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Lembretes da Agenda salvos.", {
      description: [
        data.enabled ? "Lembretes de tarefa pelo WhatsApp: ligados." : "Lembretes de tarefa pelo WhatsApp: desligados.",
        data.dailySummaryWhatsapp && data.enabled
          ? "Resumo do dia às 7h: no sino e no WhatsApp."
          : "Resumo do dia às 7h: só no sino.",
      ].join(" "),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="agenda-reminders-enabled" />
          )}
        />
        <Label htmlFor="agenda-reminders-enabled" className="font-normal">
          Enviar os lembretes de tarefas da Agenda pelo WhatsApp do responsável
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="dailySummaryWhatsapp"
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="agenda-daily-summary-whatsapp" />
          )}
        />
        <Label htmlFor="agenda-daily-summary-whatsapp" className="font-normal">
          Enviar também o resumo do dia (às 7h) pelo WhatsApp de cada pessoa
        </Label>
      </div>

      <p className="text-xs text-muted-foreground">
        O resumo do dia sempre chega no sino de notificações às 7h (horário de Brasília), para quem tem compromissos
        naquele dia; pelo WhatsApp, só com esta opção e os lembretes por WhatsApp ligados.
      </p>

      <p className="text-xs text-muted-foreground">
        Desativado, nenhum lembrete sai pelo WhatsApp — o aviso continua aparecendo no sino de notificações do
        sistema. Lembretes que vencerem enquanto estiver desativado não são enviados depois, ao reativar.
      </p>

      <Button type="submit" size="sm" className="w-fit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}

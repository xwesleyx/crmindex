"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Priority } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateInstallation } from "@/features/installations/actions";
import {
  installationFormSchema,
  type InstallationFormInput,
} from "@/features/installations/schema";
import type { InstallationListItem } from "@/features/installations/types";
import { PRIORITY_LABELS } from "@/features/leads/labels";
import type { AssignableUser } from "@/features/leads/types";

type InstallationFormRawValues = z.input<typeof installationFormSchema>;

function toDateTimeLocalValue(date?: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function InstallationForm({
  installation,
  assignableUsers,
  onSuccess,
}: {
  installation: InstallationListItem;
  assignableUsers: AssignableUser[];
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<InstallationFormRawValues, unknown, InstallationFormInput>({
    resolver: zodResolver(installationFormSchema),
    defaultValues: {
      responsibleId: installation.responsibleId ?? undefined,
      priority: installation.priority,
      // datetime-local só aceita "AAAA-MM-DDTHH:mm" — um Date aqui deixava
      // o campo em branco ao editar.
      scheduledAt: toDateTimeLocalValue(installation.scheduledAt) || undefined,
      dueAt: toDateTimeLocalValue(installation.dueAt) || undefined,
      notes: installation.notes ?? undefined,
    },
  });

  async function onSubmit(data: InstallationFormInput) {
    const result = await updateInstallation(installation.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Instalação atualizada.");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Responsável</Label>
          <Controller
            control={control}
            name="responsibleId"
            render={({ field }) => (
              <Select
                value={field.value ?? "unassigned"}
                onValueChange={(v) => field.onChange(v === "unassigned" ? undefined : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sem responsável</SelectItem>
                  {assignableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Prioridade</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Priority).map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheduledAt">Data agendada</Label>
          <Input
            id="scheduledAt"
            type="datetime-local"
            {...register("scheduledAt")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueAt">Prazo</Label>
          <Input
            id="dueAt"
            type="datetime-local"
            {...register("dueAt")}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}

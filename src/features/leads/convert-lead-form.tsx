"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Priority } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { convertLeadToOpportunity } from "@/features/leads/actions";
import { PRIORITY_LABELS } from "@/lib/priority";
import { convertLeadSchema, type ConvertLeadInput } from "@/features/leads/schema";
import type { AssignableUser, LeadListItem } from "@/features/leads/types";

type StageOption = { id: string; name: string };

type ConvertLeadFormRawValues = z.input<typeof convertLeadSchema>;

export function ConvertLeadForm({
  lead,
  stages,
  assignableUsers,
  onSuccess,
}: {
  lead: LeadListItem;
  stages: StageOption[];
  assignableUsers: AssignableUser[];
  onSuccess: (opportunityId: string) => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ConvertLeadFormRawValues, unknown, ConvertLeadInput>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: {
      title: lead.companyName ? `${lead.companyName} — Oportunidade` : `${lead.name} — Oportunidade`,
      stageId: stages[0]?.id ?? "",
      priority: lead.priority,
      estimatedValueCents: 0,
      ownerId: lead.responsibleId ?? undefined,
    },
  });

  async function onSubmit(data: ConvertLeadInput) {
    const result = await convertLeadToOpportunity(lead.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Lead convertido em oportunidade.");
    onSuccess(result.data.opportunityId);
    router.push(`/crm/oportunidades/${result.data.opportunityId}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cria uma oportunidade a partir de {lead.name}
        {lead.companyName ? ` (${lead.companyName})` : ""}. Empresa e contato são reaproveitados
        automaticamente se já existirem no CRM.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">Título da oportunidade</Label>
          <Input id="title" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Etapa inicial</Label>
          <Controller
            control={control}
            name="stageId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.stageId && <p className="text-xs text-destructive">{errors.stageId.message}</p>}
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
          <Label>Valor estimado</Label>
          <Controller
            control={control}
            name="estimatedValueCents"
            render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
          />
          {errors.estimatedValueCents && (
            <p className="text-xs text-destructive">{errors.estimatedValueCents.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Responsável</Label>
          <Controller
            control={control}
            name="ownerId"
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
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Convertendo..." : "Converter em oportunidade"}
        </Button>
      </DialogFooter>
    </form>
  );
}

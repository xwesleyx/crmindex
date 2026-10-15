"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LeadOrigin, Priority } from "@prisma/client";
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
import { Textarea } from "@/components/ui/textarea";
import { createOpportunity, updateOpportunity } from "@/features/opportunities/actions";
import { ORIGIN_LABELS, PRIORITY_LABELS } from "@/features/opportunities/labels";
import { opportunityFormSchema, type OpportunityFormInput } from "@/features/opportunities/schema";
import type { OpportunityListItem } from "@/features/opportunities/types";
import type { AssignableUser } from "@/features/leads/types";
import type { CompanyOption } from "@/features/companies/types";
import type { ContactOption } from "@/features/contacts/types";

type OpportunityFormRawValues = z.input<typeof opportunityFormSchema>;

type StageOption = { id: string; name: string };

type OpportunityFormProps = {
  mode: "create" | "edit";
  opportunity?: OpportunityListItem;
  stages: StageOption[];
  contactOptions: ContactOption[];
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  defaultCompanyId?: string;
  defaultContactId?: string;
  onSuccess: (id: string) => void;
};

function toDateTimeLocalValue(date?: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function OpportunityForm({
  mode,
  opportunity,
  stages,
  contactOptions,
  companyOptions,
  assignableUsers,
  defaultCompanyId,
  defaultContactId,
  onSuccess,
}: OpportunityFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OpportunityFormRawValues, unknown, OpportunityFormInput>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      title: opportunity?.title ?? "",
      contactId: opportunity?.contactId ?? defaultContactId ?? undefined,
      companyId: opportunity?.companyId ?? defaultCompanyId ?? undefined,
      ownerId: opportunity?.ownerId ?? undefined,
      stageId: opportunity?.stageId ?? stages[0]?.id ?? "",
      priority: opportunity?.priority ?? Priority.NORMAL,
      estimatedValueCents: opportunity?.estimatedValueCents ?? 0,
      recurringValueCents: opportunity?.recurringValueCents ?? 0,
      origin: opportunity?.origin ?? LeadOrigin.OUTRO,
      // Inputs date/datetime-local só aceitam texto ("AAAA-MM-DD"/
      // "AAAA-MM-DDTHH:mm") — um Date aqui deixava o campo em branco ao editar.
      expectedCloseAt: toDateTimeLocalValue(opportunity?.expectedCloseAt).slice(0, 10) || undefined,
      lastInteractionAt: toDateTimeLocalValue(opportunity?.lastInteractionAt) || undefined,
      description: opportunity?.description ?? undefined,
      notes: opportunity?.notes ?? undefined,
    },
  });

  async function onSubmit(data: OpportunityFormInput) {
    if (mode === "create") {
      const result = await createOpportunity(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Oportunidade criada.");
      onSuccess(result.data.id);
      return;
    }

    const result = await updateOpportunity(opportunity!.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Oportunidade atualizada.");
    onSuccess(opportunity!.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" placeholder="Ex: Implantação ERP - Empresa ABC" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
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
          <Label>Valor recorrente (mensal)</Label>
          <Controller
            control={control}
            name="recurringValueCents"
            render={({ field }) => (
              <MoneyInput value={field.value ?? 0} onChange={field.onChange} />
            )}
          />
          {errors.recurringValueCents && (
            <p className="text-xs text-destructive">{errors.recurringValueCents.message}</p>
          )}
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

        {mode === "create" && (
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
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Origem</Label>
          <Controller
            control={control}
            name="origin"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(LeadOrigin).map((origin) => (
                    <SelectItem key={origin} value={origin}>
                      {ORIGIN_LABELS[origin]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Empresa</Label>
          <Controller
            control={control}
            name="companyId"
            render={({ field }) => (
              <Select
                value={field.value ?? "none"}
                onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem empresa</SelectItem>
                  {companyOptions.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.tradeName || company.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Contato</Label>
          <Controller
            control={control}
            name="contactId"
            render={({ field }) => (
              <Select
                value={field.value ?? "none"}
                onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem contato</SelectItem>
                  {contactOptions.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expectedCloseAt">Previsão de fechamento</Label>
          <Input
            id="expectedCloseAt"
            type="date"
            {...register("expectedCloseAt")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastInteractionAt">Última interação</Label>
          <Input
            id="lastInteractionAt"
            type="datetime-local"
            {...register("lastInteractionAt")}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea id="description" rows={2} {...register("description")} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : mode === "create"
              ? "Criar oportunidade"
              : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}

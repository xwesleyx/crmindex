"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LeadOrigin, Priority } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { CnpjLookupButton } from "@/components/ui/cnpj-lookup-button";
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
import type { CnpjLookupResult } from "@/lib/cnpj-lookup";
import { createLead, updateLead } from "@/features/leads/actions";
import { LEAD_ORIGIN_LABELS, PRIORITY_LABELS, LEAD_STATUS_LABELS } from "@/features/leads/labels";
import {
  EDITABLE_LEAD_STATUSES,
  leadFormSchema,
  type LeadFormInput,
} from "@/features/leads/schema";

// A entrada bruta do formulário (strings de <input>) diverge da saída
// validada (Date, undefined em vez de "") por causa dos z.preprocess/coerce
// no schema — useForm precisa dos dois tipos separadamente (ver docs do
// react-hook-form sobre "TTransformedValues").
type LeadFormRawValues = z.input<typeof leadFormSchema>;
import type { AssignableUser, LeadListItem } from "@/features/leads/types";

function toDateTimeLocalValue(date?: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

type LeadFormProps = {
  mode: "create" | "edit";
  lead?: LeadListItem;
  assignableUsers: AssignableUser[];
  onSuccess: () => void;
};

export function LeadForm({ mode, lead, assignableUsers, onSuccess }: LeadFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormRawValues, unknown, LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: lead?.name ?? "",
      phone: lead?.phone ?? "",
      whatsapp: lead?.whatsapp ?? undefined,
      email: lead?.email ?? undefined,
      companyName: lead?.companyName ?? undefined,
      companyCnpj: lead?.companyCnpj ?? undefined,
      origin: lead?.origin ?? LeadOrigin.OUTRO,
      priority: lead?.priority ?? Priority.NORMAL,
      status: (lead?.status as LeadFormInput["status"]) ?? "NOVO",
      notes: lead?.notes ?? undefined,
      responsibleId: lead?.responsibleId ?? undefined,
      // datetime-local só aceita "AAAA-MM-DDTHH:mm" — um Date aqui deixava
      // o campo em branco ao editar.
      nextActionAt: toDateTimeLocalValue(lead?.nextActionAt) || undefined,
      nextActionNote: lead?.nextActionNote ?? undefined,
      lastInteractionAt: toDateTimeLocalValue(lead?.lastInteractionAt) || undefined,
    },
  });

  const cnpjValue = watch("companyCnpj") as string | undefined;

  // Só preenche o nome da empresa — telefone/e-mail do lead são da pessoa
  // de contato, não da empresa, não faz sentido a lupa sobrescrever.
  function handleCnpjLookup(result: CnpjLookupResult) {
    setValue("companyName", result.nomeFantasia || result.razaoSocial, { shouldDirty: true });
  }

  async function onSubmit(data: LeadFormInput) {
    const result =
      mode === "create" ? await createLead(data) : await updateLead(lead!.id, data);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Lead criado." : "Lead atualizado.");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" placeholder="(11) 91234-5678" {...register("phone")} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" placeholder="(11) 91234-5678" {...register("whatsapp")} />
          {errors.whatsapp && (
            <p className="text-xs text-destructive">{errors.whatsapp.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyName">Empresa</Label>
          <Input id="companyName" {...register("companyName")} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="companyCnpj">CNPJ</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="companyCnpj"
              placeholder="00.000.000/0000-00"
              className="flex-1"
              {...register("companyCnpj")}
            />
            <CnpjLookupButton cnpj={cnpjValue} onResult={handleCnpjLookup} />
          </div>
          {errors.companyCnpj && (
            <p className="text-xs text-destructive">{errors.companyCnpj.message}</p>
          )}
        </div>

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
                      {LEAD_ORIGIN_LABELS[origin]}
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
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {LEAD_STATUS_LABELS[status]}
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
            name="responsibleId"
            render={({ field }) => (
              <Select
                value={field.value ?? "unassigned"}
                onValueChange={(value) =>
                  field.onChange(value === "unassigned" ? undefined : value)
                }
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
          <Label htmlFor="lastInteractionAt">Última interação</Label>
          <Input
            id="lastInteractionAt"
            type="datetime-local"
            {...register("lastInteractionAt")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nextActionAt">Próxima ação</Label>
          <Input
            id="nextActionAt"
            type="datetime-local"
            {...register("nextActionAt")}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="nextActionNote">Observação da próxima ação</Label>
          <Input
            id="nextActionNote"
            placeholder="Ex: ligar amanhã de manhã"
            {...register("nextActionNote")}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : mode === "create" ? "Criar lead" : "Salvar alterações"}
        </Button>
      </DialogFooter>
    </form>
  );
}

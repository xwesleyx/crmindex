"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CustomerStatus } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomer } from "@/features/customers/actions";
import { CUSTOMER_STATUS_LABELS } from "@/features/customers/labels";
import { customerFormSchema, type CustomerFormInput } from "@/features/customers/schema";
import type { CustomerListItem } from "@/features/customers/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";

type CustomerFormRawValues = z.input<typeof customerFormSchema>;

export function CustomerForm({
  customer,
  assignableUsers,
  regions,
  onSuccess,
}: {
  customer: CustomerListItem;
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
  onSuccess: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<CustomerFormRawValues, unknown, CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      status: customer.status,
      responsibleId: customer.responsibleId ?? undefined,
      // Todo cliente já nasce com uma região (a padrão, quando nenhuma foi
      // escolhida) — regionId só fica undefined aqui num registro antigo
      // que nunca passou pela migração de backfill.
      regionId: customer.regionId ?? regions.find((r) => r.isDefault)?.id ?? undefined,
      notes: customer.notes ?? undefined,
    },
  });

  async function onSubmit(data: CustomerFormInput) {
    const result = await updateCustomer(customer.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Cliente atualizado.");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  {Object.values(CustomerStatus).map((status) => (
                    <SelectItem key={status} value={status}>
                      {CUSTOMER_STATUS_LABELS[status]}
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
          <Label>Região</Label>
          <Controller
            control={control}
            name="regionId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: region.color }}
                        />
                        {region.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

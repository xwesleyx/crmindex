"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PaymentMethod } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
import { updateSale } from "@/features/sales/actions";
import { PAYMENT_METHOD_LABELS } from "@/features/sales/labels";
import { updateSaleSchema, type UpdateSaleInput } from "@/features/sales/schema";
import type { SaleDetail } from "@/features/sales/types";

type SaleFormRawValues = z.input<typeof updateSaleSchema>;

export function SaleForm({ sale, onSuccess }: { sale: SaleDetail; onSuccess: () => void }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormRawValues, unknown, UpdateSaleInput>({
    resolver: zodResolver(updateSaleSchema),
    defaultValues: {
      discountCents: sale.discountCents,
      recurringAmountCents: sale.recurringAmountCents,
      paymentMethod: sale.paymentMethod ?? undefined,
      notes: sale.notes ?? undefined,
    },
  });

  async function onSubmit(data: UpdateSaleInput) {
    const result = await updateSale(sale.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Venda atualizada.");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Desconto</Label>
          <Controller
            control={control}
            name="discountCents"
            render={({ field }) => <MoneyInput value={field.value ?? 0} onChange={field.onChange} />}
          />
          {errors.discountCents && (
            <p className="text-xs text-destructive">{errors.discountCents.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Valor recorrente (mensal)</Label>
          <Controller
            control={control}
            name="recurringAmountCents"
            render={({ field }) => (
              <MoneyInput value={field.value ?? 0} onChange={field.onChange} />
            )}
          />
          {errors.recurringAmountCents && (
            <p className="text-xs text-destructive">{errors.recurringAmountCents.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Forma de pagamento</Label>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <Select
                value={field.value ?? "none"}
                onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {Object.values(PaymentMethod).map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
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

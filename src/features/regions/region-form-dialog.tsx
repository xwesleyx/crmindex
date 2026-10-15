"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactElement, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRegion, updateRegion } from "@/features/regions/actions";
import type { RegionListItem } from "@/features/regions/queries";
import { regionFormSchema, type RegionFormInput } from "@/features/regions/schema";

// Cor sugerida ao criar uma região nova — só o valor inicial do
// input[type=color], o usuário pode trocar livremente pra qualquer hex.
function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 65, 50);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s * Math.min(l, 100 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

type RegionFormDialogBaseProps = { mode: "create" | "edit"; region?: RegionListItem };

type RegionFormDialogProps =
  | (RegionFormDialogBaseProps & { trigger: ReactElement; open?: never; onOpenChange?: never })
  | (RegionFormDialogBaseProps & { trigger?: never; open: boolean; onOpenChange: (open: boolean) => void });

export function RegionFormDialog(props: RegionFormDialogProps) {
  const { mode, region } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = props.trigger ? internalOpen : props.open;
  const setOpen = props.trigger ? setInternalOpen : props.onOpenChange;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegionFormInput>({
    resolver: zodResolver(regionFormSchema),
    defaultValues: { name: region?.name ?? "", color: region?.color ?? randomColor() },
  });

  async function onSubmit(data: RegionFormInput) {
    const result = mode === "create" ? await createRegion(data) : await updateRegion(region!.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "Região criada." : "Região atualizada.");
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger && <DialogTrigger render={props.trigger} />}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova região" : "Editar região"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" placeholder="Ex: Grande Vitória" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color">Cor</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  {/* Os dois campos precisam compartilhar o mesmo valor
                      controlado (via Controller) — registrar os dois direto
                      no react-hook-form com o mesmo nome (register("color")
                      duas vezes) não sincroniza entre si: escolher a cor no
                      seletor nativo (grid) não atualizava o campo de texto
                      com o hexadecimal. */}
                  <input
                    id="color"
                    type="color"
                    value={field.value || "#000000"}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-8 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                  />
                  <Input
                    aria-label="Código hex da cor"
                    maxLength={7}
                    className="uppercase"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </div>
              )}
            />
            {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : mode === "create" ? "Criar região" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

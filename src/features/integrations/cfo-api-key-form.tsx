"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeCfoApiKey, updateCfoApiKey } from "@/features/integrations/actions";
import { cfoApiKeySchema, type CfoApiKeyInput } from "@/features/integrations/schema";

export function CfoApiKeyForm({ configured }: { configured: boolean }) {
  const [removing, setRemoving] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CfoApiKeyInput>({
    resolver: zodResolver(cfoApiKeySchema),
    defaultValues: { apiKey: "" },
  });

  async function onSubmit(data: CfoApiKeyInput) {
    const result = await updateCfoApiKey(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("API key da CFO salva.");
    reset({ apiKey: "" });
  }

  async function handleRemove() {
    setRemoving(true);
    const result = await removeCfoApiKey();
    setRemoving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("API key removida.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
      <Label htmlFor="cfo-api-key">{configured ? "Trocar a API key" : "API key da CFO"}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="cfo-api-key"
          type="password"
          placeholder={configured ? "Nova API key (deixe em branco pra manter a atual)" : "Cole a API key aqui"}
          autoComplete="off"
          className="sm:max-w-sm"
          {...register("apiKey")}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
          {configured && (
            <Button type="button" variant="outline" size="sm" disabled={removing} onClick={handleRemove}>
              {removing ? "Removendo..." : "Remover"}
            </Button>
          )}
        </div>
      </div>
      {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey.message}</p>}
      <p className="text-xs text-muted-foreground">
        Crie uma conta gratuita em{" "}
        <a
          href="https://cfo.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          cfo.com.br
        </a>
        , gere uma API key e cole acima. Fica salva no banco, não precisa mexer no .env nem reiniciar o servidor.
      </p>
    </form>
  );
}

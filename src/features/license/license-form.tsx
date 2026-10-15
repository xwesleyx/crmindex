"use client";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MaskedInput } from "@/components/ui/masked-input";
import { maskCNPJ } from "@/lib/br-masks";
import { checkLicense, saveLicenseCnpj } from "@/features/license/actions";

export function LicenseCnpjForm({ cnpj }: { cnpj: string | null }) {
  const [value, setValue] = useState(cnpj ? maskCNPJ(cnpj) : "");
  const [isPending, startTransition] = useTransition();
  const changed = value.replace(/\D/g, "") !== (cnpj ?? "");

  function save() {
    startTransition(async () => {
      const result = await saveLicenseCnpj(value);
      if (!result.success) toast.error(result.error);
      else if (result.message?.includes("travado")) toast.warning(result.message, { duration: 8000 });
      else toast.success(result.message ?? "CNPJ salvo.");
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="license-cnpj">CNPJ do cliente</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <MaskedInput
          id="license-cnpj"
          mask={maskCNPJ}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="00.000.000/0000-00"
          className="sm:w-56"
        />
        <Button size="sm" disabled={!changed || isPending} onClick={save}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar CNPJ
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        É o vínculo desta instalação: o CRM só funciona se este CNPJ estiver na lista de ativos publicada no GitHub.
      </p>
    </div>
  );
}

export function CheckLicenseButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await checkLicense();
          if (result.success) toast.success(result.message ?? "Consultado.");
          else toast.error("Falha na consulta", { description: result.error, duration: 8000 });
        })
      }
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Verificar agora
    </Button>
  );
}

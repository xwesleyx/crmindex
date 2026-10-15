"use client"

import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { fetchCompanyByCnpj, type CnpjLookupResult } from "@/lib/cnpj-lookup"
import { onlyDigits } from "@/lib/validators"

// Ícone de lupa ao lado de todo campo de CNPJ do sistema — consulta a
// Receita Federal (via BrasilAPI, dados oficiais espelhados) e devolve os
// dados pro form preencher os campos que fizerem sentido pra ele.
export function CnpjLookupButton({
  cnpj,
  onResult,
}: {
  cnpj: string | undefined | null
  onResult: (result: CnpjLookupResult) => void
}) {
  const [loading, setLoading] = useState(false)
  const disabled = loading || !cnpj || onlyDigits(cnpj).length !== 14

  async function handleClick() {
    if (!cnpj) return
    setLoading(true)
    try {
      const outcome = await fetchCompanyByCnpj(cnpj)
      if (!outcome.ok) {
        const messages: Record<typeof outcome.reason, string> = {
          invalid: "CNPJ incompleto — confira os 14 dígitos.",
          not_found: "CNPJ não encontrado na Receita Federal.",
          rate_limited: "Muitas consultas seguidas — aguarde alguns segundos e tente de novo.",
          error: "Não foi possível consultar a Receita Federal agora.",
        }
        toast.error(messages[outcome.reason])
        return
      }
      onResult(outcome.data)
      toast.success("Dados da Receita Federal preenchidos.")
      if (outcome.data.situacao && outcome.data.situacao !== "ATIVA") {
        toast.warning(`Atenção: situação cadastral do CNPJ é "${outcome.data.situacao}".`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Consultar CNPJ na Receita Federal"
      title="Consultar CNPJ na Receita Federal"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
    </Button>
  )
}

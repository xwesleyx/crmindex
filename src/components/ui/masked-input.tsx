import * as React from "react"

import { Input } from "@/components/ui/input"

// Aplica uma máscara progressiva (ex: CEP, CNPJ) enquanto o usuário digita —
// reformata `e.target.value` ANTES de repassar o evento pro onChange que vem
// do register() do react-hook-form, então o campo continua não-controlado
// (não precisa virar Controller). Qualquer caractere que a máscara descarta
// (letra num campo numérico, por exemplo) nunca chega a aparecer no input —
// é o mecanismo que "proíbe digitar errado" pedido pelo usuário.
function MaskedInput({
  mask,
  onChange,
  ...props
}: React.ComponentProps<"input"> & { mask: (rawValue: string) => string }) {
  return (
    <Input
      {...props}
      onChange={(e) => {
        e.target.value = mask(e.target.value);
        onChange?.(e);
      }}
    />
  )
}

export { MaskedInput }

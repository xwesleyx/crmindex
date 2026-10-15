import type { CSSProperties } from "react";

import { cn } from "cn";
import { formatMoneyCents } from "@/lib/money";

const SIZE_CLASS = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-xl font-semibold",
  xl: "text-2xl font-semibold",
} as const;

export type MoneyDisplaySize = keyof typeof SIZE_CLASS;

// Padrão único de exibição de valores monetários no sistema (seção 7 do
// escopo de refinamento) — tabular-nums pra alinhar dígitos em tabelas/
// listas, tamanhos consistentes por contexto. Sempre a partir de centavos
// (lib/money.ts), nunca formatação manual espalhada pelos componentes.
export function MoneyDisplay({
  cents,
  size = "md",
  muted = false,
  className,
  style,
}: {
  cents: number;
  size?: MoneyDisplaySize;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        SIZE_CLASS[size],
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
      style={style}
    >
      {formatMoneyCents(cents)}
    </span>
  );
}

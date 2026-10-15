"use client";

import { Input } from "@/components/ui/input";
import { digitsToCents, formatMoneyCents } from "@/lib/money";

export function MoneyInput({
  value,
  onChange,
  id,
}: {
  value: number;
  onChange: (cents: number) => void;
  id?: string;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      value={formatMoneyCents(value)}
      onChange={(e) => onChange(digitsToCents(e.target.value))}
      placeholder="R$ 0,00"
    />
  );
}

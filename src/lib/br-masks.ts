import { onlyDigits } from "@/lib/validators";

// Máscaras progressivas (formatam conforme o usuário digita, não só no
// valor final) — usadas pelo MaskedInput (src/components/ui/masked-input.tsx)
// pra impedir que caractere fora do padrão apareça no campo.
export function maskCEP(rawValue: string): string {
  const digits = onlyDigits(rawValue).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function maskCNPJ(rawValue: string): string {
  const digits = onlyDigits(rawValue).slice(0, 14);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 8),
    digits.slice(8, 12),
    digits.slice(12, 14),
  ].filter(Boolean);

  let result = parts[0] ?? "";
  if (parts[1]) result += `.${parts[1]}`;
  if (parts[2]) result += `.${parts[2]}`;
  if (parts[3]) result += `/${parts[3]}`;
  if (parts[4]) result += `-${parts[4]}`;
  return result;
}

import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

// Tons semânticos — mesmos tokens do design system (--success/--warning/
// --destructive/--primary), nunca cor nova. Toda badge de status/prioridade
// do sistema passa por aqui, então mudar a paleta muda tudo de uma vez.
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "destructive";

export const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "border-border text-muted-foreground",
  info: "border-transparent bg-primary/10 text-primary",
  success: "border-transparent bg-success/10 text-success",
  warning: "border-transparent bg-warning/10 text-warning",
  destructive: "border-transparent bg-destructive/10 text-destructive",
};

// Variante "sólida" para estados finais/definitivos (ex: Venda Ganha) — mais
// peso visual que o tom translúcido padrão.
export const TONE_CLASS_SOLID: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-muted text-foreground",
  info: "border-transparent bg-primary text-primary-foreground",
  success: "border-transparent bg-success text-success-foreground",
  warning: "border-transparent bg-warning text-warning-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
};

export function StatusBadge({
  label,
  tone = "neutral",
  solid = false,
  className,
}: {
  label: string;
  tone?: BadgeTone;
  solid?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(solid ? TONE_CLASS_SOLID[tone] : TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}

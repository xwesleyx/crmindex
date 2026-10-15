import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

type ModeToggleProps = {
  theme: "light" | "dark";
  onToggle: () => void;
};

export function ModeToggle({ theme, onToggle }: ModeToggleProps) {
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
      aria-pressed={isDark}
    >
      {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  );
}

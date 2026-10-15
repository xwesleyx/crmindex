import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "cn";

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const SIZE_CLASS = {
  sm: "size-7 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-9 text-sm",
} as const;

// Iniciais de pessoa/empresa em avatar — usado no header, listas de
// usuários e onde quer que precisemos representar um responsável sem foto.
export function EntityAvatar({
  name,
  size = "md",
  tone = "primary",
  src,
  className,
}: {
  name: string;
  size?: keyof typeof SIZE_CLASS;
  tone?: "primary" | "muted";
  // Foto de perfil (userAvatarSrc) — sem foto, ficam as iniciais.
  src?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZE_CLASS[size], className)}>
      {src && <AvatarImage src={src} alt={`Foto de ${name}`} />}
      <AvatarFallback
        className={cn(
          "font-semibold",
          tone === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

import { BookOpen } from "lucide-react";

type PenBookIconProps = {
  className?: string;
};

// Marca do INDEX: livro aberto (lucide) com uma caneta apoiada por cima,
// inclinada, remetendo à assinatura animada que aparece no login.
export function PenBookIcon({ className }: PenBookIconProps) {
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex" }}>
      <BookOpen className="size-full" strokeWidth={2} />
      <svg
        viewBox="0 0 24 24"
        className="absolute -top-[15%] -right-[22%] size-[62%]"
        style={{ transform: "rotate(45deg)" }}
        aria-hidden
      >
        <path
          d="M4 20 L16 8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path
          d="M15 7 L19 3 L21 5 L17 9 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

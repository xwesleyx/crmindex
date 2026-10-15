import type { ReactNode } from "react";

// A tela de login (src/features/auth/login-form.tsx) controla seu próprio
// fundo em tela cheia (a foto da cena, via BookPanel) e o posicionamento do
// card — esse layout só dá o "chão" (altura mínima, cor de fallback pras
// outras páginas do grupo, como error.tsx) e um título acessível: a marca
// "INDEX" já aparece visualmente dentro da própria foto, então não repete
// aqui como texto visível, só pra leitor de tela/SEO.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <h1 className="sr-only">INDEX — Seu negócio, em boas mãos.</h1>
      {children}
    </div>
  );
}

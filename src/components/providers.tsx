"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

// O Toaster (sonner) não mora aqui — DashboardShell monta o dele, escopado
// junto com a classe "dark" (ver comentário lá). Montar um aqui TAMBÉM
// duplicaria toda notificação (o toast() do sonner manda pra todo Toaster
// montado ao mesmo tempo). A tela de login não usa toast hoje.
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Sem next-themes: nada no app usa o ThemeProvider dele (o modo escuro é
// controlado por useAppTheme, uma classe "dark" num wrapper próprio, não no
// <html>) — useTheme() daqui sempre devolvia "system" (nunca o tema real),
// deixando o popup de notificação com cor errada/ilegível às vezes.
// DashboardShell passa o `theme` de verdade explicitamente.
const Toaster = ({ theme = "light", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          // Pedido explícito: preto no claro, branco no escuro — não a cor
          // "quase preta"/"quase branca" do token --popover-foreground.
          "--normal-text": theme === "dark" ? "#ffffff" : "#000000",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

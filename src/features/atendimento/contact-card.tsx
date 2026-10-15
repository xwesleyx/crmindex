"use client";

import { Check, Copy, Phone } from "lucide-react";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPhone } from "@/lib/format";

// Bloco "Contato" do painel direito (seção 13) — telefone em destaque +
// copiar. `secondary` é o telefone alternativo (whatsapp vs phone) quando os
// dois existem e são diferentes.
export function ContactCard({ phone, secondary }: { phone: string | null; secondary?: string | null }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponível (ex: contexto não seguro) — sem feedback, sem quebrar a UI
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
      <Phone className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{phone ? formatPhone(phone) : "Sem telefone"}</p>
        {secondary && secondary !== phone && (
          <p className="truncate text-xs text-muted-foreground">{formatPhone(secondary)}</p>
        )}
      </div>
      {phone && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </button>
            }
          />
          <TooltipContent>{copied ? "Copiado" : "Copiar telefone"}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

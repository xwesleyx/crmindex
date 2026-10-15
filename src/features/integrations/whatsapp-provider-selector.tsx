"use client";

import { BadgeCheck, Ban, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { setWhatsappProvider } from "@/features/integrations/actions";
import type { WhatsappProviderInput } from "@/features/integrations/schema";

type ProviderName = WhatsappProviderInput["provider"];

const OPTIONS: { value: ProviderName; title: string; description: string; icon: typeof QrCode }[] = [
  {
    value: "neonize",
    title: "Neonize (QR code)",
    description: "Conecta o número escaneando um QR code, como o WhatsApp Web. Precisa do whatsapp-service rodando.",
    icon: QrCode,
  },
  {
    value: "whatsapp_cloud",
    title: "API oficial (Meta)",
    description: "WhatsApp Cloud API da Meta. Sem risco de bloqueio, mas exige app na Meta e segue a regra das 24h.",
    icon: BadgeCheck,
  },
  {
    value: "manual",
    title: "Nenhum (manual)",
    description: "Nada sai pelo WhatsApp de verdade — a Central só registra as mensagens.",
    icon: Ban,
  },
];

export function WhatsappProviderSelector({ current }: { current: ProviderName }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<ProviderName | null>(null);

  async function choose(provider: ProviderName) {
    if (provider === current || saving) return;
    setSaving(provider);
    const result = await setWhatsappProvider({ provider });
    setSaving(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Provider do WhatsApp alterado. Vale para as conversas novas.");
    startTransition(() => router.refresh());
  }

  return (
    <div role="radiogroup" aria-label="Provider do WhatsApp" className="grid gap-3 md:grid-cols-3">
      {OPTIONS.map((option) => {
        const active = option.value === current;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isPending || saving !== null}
            onClick={() => choose(option.value)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-wait",
              active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-accent/40"
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {option.title}
                {active && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">Ativo</span>}
                {saving === option.value && <span className="text-xs font-normal text-muted-foreground">Salvando...</span>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

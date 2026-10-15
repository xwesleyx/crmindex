"use client";

import { Check, Loader2, Pencil, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import { renameContact, resetContactNameToWhatsapp } from "@/features/contacts/actions";

// Nome do contato editável no lugar (tela do contato e painel do
// Atendimento). O padrão é o nome do perfil do WhatsApp; depois de renomear,
// aparece a opção de voltar a ele.
export function ContactNameEditor({
  contactId,
  name,
  whatsappName,
  variant = "title",
  className,
}: {
  contactId: string;
  name: string;
  whatsappName: string | null;
  variant?: "title" | "compact";
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [isPending, startTransition] = useTransition();

  const differsFromWhatsapp = !!whatsappName && whatsappName !== name;

  function startEditing() {
    setDraft(name);
    setEditing(true);
  }

  function save() {
    const next = draft.trim();
    if (next === name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await renameContact(contactId, next);
      if (!result.success) {
        toast.error("Não foi possível renomear", { description: result.error });
        return;
      }
      toast.success("Contato renomeado", {
        description: whatsappName
          ? `Agora aparece como "${next}" em todo o CRM. Dá para voltar ao nome do WhatsApp ("${whatsappName}") quando quiser.`
          : `Agora aparece como "${next}" em todo o CRM.`,
      });
      setEditing(false);
      router.refresh();
    });
  }

  function revert() {
    startTransition(async () => {
      const result = await resetContactNameToWhatsapp(contactId);
      if (!result.success) {
        toast.error("Não foi possível voltar ao nome do WhatsApp", { description: result.error });
        return;
      }
      toast.success("Nome do WhatsApp restaurado", {
        description: `O contato voltou a se chamar "${whatsappName}" e passa a acompanhar o nome do perfil do WhatsApp.`,
      });
      setEditing(false);
      router.refresh();
    });
  }

  const isTitle = variant === "title";

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      {editing ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
            maxLength={120}
            disabled={isPending}
            aria-label="Nome do contato"
            className={cn(isTitle ? "h-9 w-72 text-base font-semibold" : "h-7 w-full text-sm")}
          />
          <Button type="submit" size="icon-sm" disabled={isPending} aria-label="Salvar nome">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            onClick={() => setEditing(false)}
            aria-label="Cancelar"
          >
            <X className="size-4" />
          </Button>
        </form>
      ) : (
        <div className="group flex min-w-0 items-center gap-1">
          <span className={cn("truncate", isTitle ? "" : "text-sm font-medium")}>{name}</span>
          <button
            type="button"
            onClick={startEditing}
            title="Renomear contato"
            aria-label="Renomear contato"
            className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
          >
            <Pencil className={isTitle ? "size-4" : "size-3.5"} />
          </button>
        </div>
      )}

      {differsFromWhatsapp && (
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs font-normal text-muted-foreground">
          <span className="truncate">No WhatsApp: {whatsappName}</span>
          <button
            type="button"
            onClick={revert}
            disabled={isPending}
            className="flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
          >
            <Undo2 className="size-3" />
            Usar este nome
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { Priority } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createConversation, searchContacts } from "@/features/atendimento/actions";
import { PRIORITY_LABELS } from "@/lib/priority";

type ContactResult = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  company: { id: string; legalName: string; tradeName: string | null } | null;
};

// "Nova conversa" (seção 8): é a porta de entrada manual desta etapa — não
// existe webhook do WhatsApp ainda (seção 2), então o atendente registra a
// conversa (existente ou novo contato) e a 1ª mensagem manualmente.
export function NewConversationDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [content, setContent] = useState("");
  const [direction, setDirection] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [priority, setPriority] = useState<Priority>(Priority.NORMAL);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      const found = await searchContacts(query);
      setResults(found);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  function reset() {
    setMode("existing");
    setQuery("");
    setResults([]);
    setSelectedContact(null);
    setName("");
    setPhone("");
    setWhatsapp("");
    setContent("");
    setDirection("INBOUND");
    setPriority(Priority.NORMAL);
  }

  const canSubmit =
    content.trim().length > 0 &&
    (mode === "existing" ? !!selectedContact : name.trim().length >= 2 && phone.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    const result = await createConversation({
      contactId: mode === "existing" ? selectedContact!.id : undefined,
      name: mode === "new" ? name : undefined,
      phone: mode === "new" ? phone : undefined,
      whatsapp: mode === "new" ? whatsapp : undefined,
      content,
      direction,
      priority,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Conversa criada.");
    setOpen(false);
    reset();
    router.push(`/atendimento/${result.data.conversationId}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nova conversa
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-full max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Registre um atendimento com um contato existente ou um novo contato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
            >
              Contato existente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
            >
              Novo contato
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Buscar contato</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedContact(null);
                  }}
                  placeholder="Nome, telefone ou empresa..."
                  className="pl-8"
                />
              </div>
              {selectedContact ? (
                <div className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span>
                    {selectedContact.name}
                    {selectedContact.company && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {selectedContact.company.tradeName || selectedContact.company.legalName}
                      </span>
                    )}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}>
                    Trocar
                  </Button>
                </div>
              ) : (
                results.length > 0 && (
                  <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1">
                    {results.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setSelectedContact(contact);
                          setResults([]);
                        }}
                        className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        {contact.name}
                        {contact.company && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {contact.company.tradeName || contact.company.legalName}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="new-contact-name">Nome</Label>
                <Input id="new-contact-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-contact-phone">Telefone</Label>
                <Input id="new-contact-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-contact-whatsapp">WhatsApp</Label>
                <Input
                  id="new-contact-whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={direction === "INBOUND" ? "default" : "outline"}
              onClick={() => setDirection("INBOUND")}
            >
              Mensagem recebida
            </Button>
            <Button
              type="button"
              size="sm"
              variant={direction === "OUTBOUND" ? "default" : "outline"}
              onClick={() => setDirection("OUTBOUND")}
            >
              Mensagem enviada
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-conversation-content">Mensagem</Label>
            <Textarea
              id="new-conversation-content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Conteúdo da mensagem..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(Priority).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Criando..." : "Criar conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

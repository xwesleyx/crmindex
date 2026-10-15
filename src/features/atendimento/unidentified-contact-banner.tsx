"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Link2, Loader2, Plus, Search, Target, UserPlus, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createCustomerForConversation,
  createLeadFromConversation,
  linkConversationToContact,
  linkConversationToCustomer,
  searchContacts,
  searchCustomers,
} from "@/features/atendimento/actions";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { NewCustomerDialog } from "@/features/customers/new-customer-dialog";
import type { RegionListItem } from "@/features/regions/queries";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { ConversationDetail } from "@/features/atendimento/types";

type ContactResult = { id: string; name: string; phone: string | null; whatsapp: string | null };
type CustomerResult = Awaited<ReturnType<typeof searchCustomers>>[number];

// "Número não identificado" (seção 6) — mostrado quando conversation.contact
// é um contato-sombra (identified:false). As 4 ações do escopo, cada uma
// reaproveitando o máximo possível do que já existe: o formulário de contato
// é o ContactFormDialog padrão, criar lead reaproveita createLeadFromConversation.
export function UnidentifiedContactBanner({
  conversation,
  companyOptions,
  crmAssignableUsers,
  regions,
}: {
  conversation: ConversationDetail;
  companyOptions: CompanyOption[];
  crmAssignableUsers: AssignableUser[];
  regions: RegionListItem[];
}) {
  const router = useRouter();
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [linkCustomerOpen, setLinkCustomerOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [creatingLead, setCreatingLead] = useState(false);

  async function handleCreateLead() {
    setCreatingLead(true);
    const result = await createLeadFromConversation(conversation.id);
    setCreatingLead(false);
    if (!result.success) {
      toast.error("Não foi possível criar o lead", { description: result.error });
      return;
    }
    toast.success("Lead criado", {
      description: "O lead foi criado com os dados deste contato e já aparece em CRM > Leads.",
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <p className="flex items-center gap-1.5 font-semibold text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          Número não identificado
        </p>
        <p className="text-xs text-muted-foreground">
          Este número ainda não está ligado a nenhum cadastro. Escolha uma opção:
        </p>
      </div>

      <ActionGroup title="Já existe no CRM?">
        <ActionButton icon={Link2} label="Contato existente" onClick={() => setLinkContactOpen(true)} />
        <ActionButton icon={Building2} label="Cliente" onClick={() => setLinkCustomerOpen(true)} />
      </ActionGroup>

      <ActionGroup title="É alguém novo?">
        <ActionButton icon={UserPlus} label="Novo contato" onClick={() => setEditContactOpen(true)} />
        <ActionButton
          icon={creatingLead ? Loader2 : Target}
          iconClassName={creatingLead ? "animate-spin" : undefined}
          label={creatingLead ? "Criando..." : "Novo lead"}
          disabled={creatingLead}
          onClick={handleCreateLead}
        />
      </ActionGroup>

      <LinkExistingContactDialog
        open={linkContactOpen}
        onOpenChange={setLinkContactOpen}
        conversationId={conversation.id}
      />
      <LinkCustomerDialog
        open={linkCustomerOpen}
        onOpenChange={setLinkCustomerOpen}
        conversation={conversation}
        companyOptions={companyOptions}
        assignableUsers={crmAssignableUsers}
        regions={regions}
      />
      <ContactFormDialog
        mode="edit"
        title="Cadastrar contato deste número"
        contact={conversation.contact}
        companyOptions={companyOptions}
        assignableUsers={crmAssignableUsers}
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
      />
    </div>
  );
}

function ActionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  iconClassName,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="w-full justify-start bg-background"
    >
      <Icon className={iconClassName ? `size-4 shrink-0 ${iconClassName}` : "size-4 shrink-0"} />
      <span className="truncate">{label}</span>
    </Button>
  );
}

function LinkExistingContactDialog({
  open,
  onOpenChange,
  conversationId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function handleSelect(contactId: string) {
    const result = await linkConversationToContact(conversationId, contactId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Conversa vinculada ao contato.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
          setResults([]);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Vincular a um contato existente</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou telefone..."
            className="pl-8"
          />
        </div>
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {results.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => handleSelect(contact.id)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {contact.name}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function LinkCustomerDialog({
  open,
  onOpenChange,
  conversation,
  companyOptions,
  assignableUsers,
  regions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationDetail;
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
}) {
  const conversationId = conversation.id;
  const { contact } = conversation;
  const contactName = contact.name;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      const found = await searchCustomers(query);
      setResults(found);
      setSearched(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  async function handleSelect(customerId: string) {
    const result = await linkConversationToCustomer(conversationId, customerId);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Conversa vinculada ao cliente.");
    onOpenChange(false);
    router.refresh();
  }

  async function handleQuickCreate() {
    setCreating(true);
    const result = await createCustomerForConversation(conversationId);
    setCreating(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Cliente cadastrado e conversa vinculada.");
    onOpenChange(false);
    router.refresh();
  }

  // "Novo" ao lado da busca: formulário completo de Novo Cliente (o mesmo da
  // tela Clientes), já com este contato e a empresa dele preenchidos; ao
  // criar, a conversa já fica vinculada ao cliente novo.
  async function handleCreatedFromForm(customerId: string) {
    const result = await linkConversationToCustomer(conversationId, customerId);
    if (!result.success) {
      toast.error("Cliente criado, mas não foi possível vincular a conversa", { description: result.error });
      router.refresh();
      return;
    }
    toast.success("Cliente cadastrado e conversa vinculada", {
      description: "O cliente já aparece em Clientes e esta conversa fica ligada a ele.",
    });
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
          setResults([]);
          setSearched(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Vincular a cliente</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome fantasia, razão social ou CNPJ..."
              className="pl-8"
            />
          </div>
          <NewCustomerDialog
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
            regions={regions}
            initialContact={{
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              whatsapp: contact.whatsapp,
              company: contact.company
                ? { id: contact.company.id, legalName: contact.company.legalName, tradeName: contact.company.tradeName }
                : null,
            }}
            initialCompany={
              contact.company
                ? {
                    id: contact.company.id,
                    legalName: contact.company.legalName,
                    tradeName: contact.company.tradeName,
                    cnpj: contact.company.cnpj,
                  }
                : null
            }
            onCreated={handleCreatedFromForm}
            trigger={
              <Button type="button" title="Cadastrar um cliente novo">
                <Plus className="size-4" />
                Novo
              </Button>
            }
          />
        </div>
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => handleSelect(customer.id)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {getCustomerDisplayName(customer)}
              </button>
            </li>
          ))}
        </ul>

        {searched && results.length === 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-2.5 text-sm">
            <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
            <Button size="xs" variant="outline" disabled={creating} onClick={handleQuickCreate}>
              Cadastro rápido: cliente &ldquo;{contactName}&rdquo;
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

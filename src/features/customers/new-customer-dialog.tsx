"use client";

import { useRouter } from "next/navigation";
import { Building2, Plus, User, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer, searchCompanies, searchContacts } from "@/features/customers/actions";
import { CompanyFormDialog } from "@/features/companies/company-form-dialog";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { formatCNPJ, formatPhone } from "@/lib/format";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";

type CompanyResult = Awaited<ReturnType<typeof searchCompanies>>[number];
type ContactResult = Awaited<ReturnType<typeof searchContacts>>[number];

// Cadastro manual de cliente (pedido do usuário: Atendimento precisa
// vincular contato a um cliente que às vezes ainda não existe). Empresa e
// Contato continuam sendo a identidade — aqui só escolhe (ou cria na hora,
// via os diálogos que já existem em Empresas/Contatos) quem vira cliente.
export type { CompanyResult as NewCustomerCompany, ContactResult as NewCustomerContact };

export function NewCustomerDialog({
  companyOptions,
  assignableUsers,
  regions,
  trigger,
  initialCompany = null,
  initialContact = null,
  onCreated,
}: {
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
  // Os opcionais abaixo servem pra abrir este mesmo formulário de outro
  // lugar (ex.: Atendimento > Vincular a cliente > Novo): botão próprio,
  // empresa/contato já preenchidos e o que fazer depois de criar — sem
  // `onCreated`, abre o cliente criado.
  trigger?: ReactElement;
  initialCompany?: CompanyResult | null;
  initialContact?: ContactResult | null;
  onCreated?: (customerId: string) => Promise<void> | void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState<CompanyResult | null>(initialCompany);
  const [contact, setContact] = useState<ContactResult | null>(initialContact);
  const [responsibleId, setResponsibleId] = useState<string>("unassigned");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCompany(initialCompany);
    setContact(initialContact);
    setResponsibleId("unassigned");
    setNotes("");
  }

  async function handleSubmit() {
    if (!company && !contact) {
      toast.error("Selecione uma empresa ou um contato.");
      return;
    }
    setSubmitting(true);
    const result = await createCustomer({
      companyId: company?.id,
      contactId: contact?.id,
      responsibleId: responsibleId === "unassigned" ? undefined : responsibleId,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error("Não foi possível cadastrar o cliente", { description: result.error });
      return;
    }
    setOpen(false);
    reset();
    if (onCreated) {
      await onCreated(result.data.id);
      return;
    }
    toast.success("Cliente cadastrado.");
    router.push(`/clientes/${result.data.id}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="size-4" />Novo Cliente</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <EntityPicker
            label="Empresa"
            icon={Building2}
            placeholder="Buscar por nome fantasia, razão social ou CNPJ..."
            search={searchCompanies}
            selected={company ? { id: company.id, label: company.tradeName || company.legalName, sub: company.cnpj ? formatCNPJ(company.cnpj) : null } : null}
            onSelect={setCompany}
            onClear={() => setCompany(null)}
            renderResult={(item) => (
              <>
                <span className="block truncate font-medium">{item.tradeName || item.legalName}</span>
                {item.cnpj && <span className="block text-xs text-muted-foreground">{formatCNPJ(item.cnpj)}</span>}
              </>
            )}
            createTrigger={
              <CompanyFormDialog
                mode="create"
                assignableUsers={assignableUsers}
                regions={regions}
                trigger={
                  <button type="button" className="text-xs text-primary hover:underline">
                    + Nova empresa
                  </button>
                }
              />
            }
          />

          <EntityPicker
            label="Contato"
            icon={User}
            placeholder="Buscar por nome ou telefone..."
            search={searchContacts}
            selected={
              contact
                ? { id: contact.id, label: contact.name, sub: formatPhone(contact.phone ?? contact.whatsapp) }
                : null
            }
            onSelect={setContact}
            onClear={() => setContact(null)}
            renderResult={(item) => (
              <>
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatPhone(item.phone ?? item.whatsapp)}
                  {item.company && ` · ${item.company.tradeName || item.company.legalName}`}
                </span>
              </>
            )}
            createTrigger={
              <ContactFormDialog
                mode="create"
                companyOptions={companyOptions}
                assignableUsers={assignableUsers}
                trigger={
                  <button type="button" className="text-xs text-primary hover:underline">
                    + Novo contato
                  </button>
                }
              />
            }
          />

          <div className="flex flex-col gap-1.5">
            <Label>Responsável</Label>
            <Select value={responsibleId} onValueChange={(v) => setResponsibleId(v ?? "unassigned")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Sem responsável</SelectItem>
                {assignableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-customer-notes">Observações</Label>
            <Textarea id="new-customer-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Cadastrando..." : "Cadastrar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Busca com debounce + seleção — mesmo padrão do LinkExistingContactDialog
// (unidentified-contact-banner.tsx), reaproveitado aqui pra Empresa e Contato.
function EntityPicker<T extends { id: string }>({
  label,
  icon: Icon,
  placeholder,
  search,
  selected,
  onSelect,
  onClear,
  renderResult,
  createTrigger,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  selected: { id: string; label: string; sub: string | null } | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  renderResult: (item: T) => React.ReactNode;
  createTrigger: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setResults(await search(query));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {createTrigger}
      </div>

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate font-medium">{selected.label}</p>
              {selected.sub && <p className="truncate text-xs text-muted-foreground">{selected.sub}</p>}
            </div>
          </div>
          <button type="button" onClick={onClear} className="shrink-0 rounded-md p-1 hover:bg-muted">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
          {results.length > 0 && (
            <ul className="flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      setQuery("");
                      setResults([]);
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {renderResult(item)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

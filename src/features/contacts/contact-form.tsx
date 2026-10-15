"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ContactLinkType, LeadOrigin } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
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
import { createContact, updateContact } from "@/features/contacts/actions";
import { ContactDuplicateDialog } from "@/features/contacts/contact-duplicate-dialog";
import { CONTACT_LINK_TYPE_LABELS, ORIGIN_LABELS } from "@/features/contacts/labels";
import { contactFormSchema, type ContactFormInput } from "@/features/contacts/schema";
import type { ContactListItem } from "@/features/contacts/types";
import type { CompanyOption } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";

type ContactFormRawValues = z.input<typeof contactFormSchema>;

type DuplicateContact = ContactListItem;

type ContactFormProps = {
  mode: "create" | "edit";
  contact?: ContactListItem;
  companyOptions: CompanyOption[];
  assignableUsers: AssignableUser[];
  defaultCompanyId?: string;
  onSuccess: (id: string) => void;
};

export function ContactForm({
  mode,
  contact,
  companyOptions,
  assignableUsers,
  defaultCompanyId,
  onSuccess,
}: ContactFormProps) {
  const [duplicate, setDuplicate] = useState<DuplicateContact | null>(null);
  const [pendingData, setPendingData] = useState<ContactFormInput | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormRawValues, unknown, ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? "",
      phone: contact?.phone ?? undefined,
      whatsapp: contact?.whatsapp ?? undefined,
      email: contact?.email ?? undefined,
      role: contact?.role ?? undefined,
      department: contact?.department ?? undefined,
      linkType: contact?.linkType ?? undefined,
      isPrimaryContact: contact?.isPrimaryContact ?? false,
      notes: contact?.notes ?? undefined,
      isActive: contact?.isActive ?? true,
      origin: contact?.origin ?? undefined,
      companyId: contact?.companyId ?? defaultCompanyId ?? undefined,
      responsibleId: contact?.responsibleId ?? undefined,
      lastInteractionAt: contact?.lastInteractionAt ?? undefined,
    },
  });

  async function submit(data: ContactFormInput, skipDuplicateCheck?: boolean) {
    const result =
      mode === "create"
        ? await createContact(data, { skipDuplicateCheck })
        : await updateContact(contact!.id, data, { skipDuplicateCheck });

    if (result.status === "duplicate") {
      setDuplicate(result.contact);
      setPendingData(data);
      return;
    }

    if (result.status === "error") {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Contato criado." : "Contato atualizado.");
    onSuccess(result.id);
  }

  return (
    <>
      <form onSubmit={handleSubmit((data) => submit(data))} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" placeholder="(11) 91234-5678" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" placeholder="(11) 91234-5678" {...register("whatsapp")} />
            {errors.whatsapp && (
              <p className="text-xs text-destructive">{errors.whatsapp.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Cargo</Label>
            <Input id="role" {...register("role")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Departamento</Label>
            <Input id="department" {...register("department")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo de vínculo</Label>
            <Controller
              control={control}
              name="linkType"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    {Object.values(ContactLinkType).map((type) => (
                      <SelectItem key={type} value={type}>
                        {CONTACT_LINK_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center gap-2 self-end pb-1.5">
            <Controller
              control={control}
              name="isPrimaryContact"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  id="isPrimaryContact"
                />
              )}
            />
            <Label htmlFor="isPrimaryContact" className="font-normal">
              Contato principal da empresa
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Empresa</Label>
            <Controller
              control={control}
              name="companyId"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem empresa</SelectItem>
                    {companyOptions.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.tradeName || company.legalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Origem</Label>
            <Controller
              control={control}
              name="origin"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informada</SelectItem>
                    {Object.values(LeadOrigin).map((origin) => (
                      <SelectItem key={origin} value={origin}>
                        {ORIGIN_LABELS[origin]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Responsável</Label>
            <Controller
              control={control}
              name="responsibleId"
              render={({ field }) => (
                <Select
                  value={field.value ?? "unassigned"}
                  onValueChange={(v) => field.onChange(v === "unassigned" ? undefined : v)}
                >
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
              )}
            />
          </div>

          <div className="flex items-center gap-2 self-end pb-1.5">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id="isActive" />
              )}
            />
            <Label htmlFor="isActive" className="font-normal">
              Contato ativo
            </Label>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : mode === "create" ? "Criar contato" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </form>

      <ContactDuplicateDialog
        duplicate={duplicate}
        onClose={() => setDuplicate(null)}
        onUseExisting={() => {
          if (duplicate) onSuccess(duplicate.id);
          setDuplicate(null);
        }}
        onContinueAnyway={() => {
          setDuplicate(null);
          if (pendingData) submit(pendingData, true);
        }}
      />
    </>
  );
}

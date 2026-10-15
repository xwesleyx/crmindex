"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LeadOrigin } from "@prisma/client";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CnpjLookupButton } from "@/components/ui/cnpj-lookup-button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskedInput } from "@/components/ui/masked-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchAddressByCep } from "@/lib/br-cep-lookup";
import { maskCEP, maskCNPJ } from "@/lib/br-masks";
import { BR_STATES } from "@/lib/br-states";
import type { CnpjLookupResult } from "@/lib/cnpj-lookup";
import { isValidPhone, onlyDigits } from "@/lib/validators";
import { createCompany, updateCompany } from "@/features/companies/actions";
import { CompanyDuplicateDialog } from "@/features/companies/company-duplicate-dialog";
import { ORIGIN_LABELS } from "@/features/companies/labels";
import { companyFormSchema, type CompanyFormInput } from "@/features/companies/schema";
import type { CompanyListItem } from "@/features/companies/types";
import type { AssignableUser } from "@/features/leads/types";
import type { RegionListItem } from "@/features/regions/queries";
import { useBrMunicipios } from "@/hooks/use-br-municipios";
import { useState } from "react";

type CompanyFormRawValues = z.input<typeof companyFormSchema>;

type DuplicateCompany = {
  id: string;
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
};

type CompanyFormProps = {
  mode: "create" | "edit";
  company?: CompanyListItem;
  assignableUsers: AssignableUser[];
  regions: RegionListItem[];
  onSuccess: (id: string) => void;
};

export function CompanyForm({ mode, company, assignableUsers, regions, onSuccess }: CompanyFormProps) {
  const [duplicate, setDuplicate] = useState<DuplicateCompany | null>(null);
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormRawValues, unknown, CompanyFormInput>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      legalName: company?.legalName ?? "",
      tradeName: company?.tradeName ?? undefined,
      cnpj: company?.cnpj ?? undefined,
      phone: company?.phone ?? undefined,
      whatsapp: company?.whatsapp ?? undefined,
      email: company?.email ?? undefined,
      website: company?.website ?? undefined,
      addressLine: company?.addressLine ?? undefined,
      addressNumber: company?.addressNumber ?? undefined,
      complement: company?.complement ?? undefined,
      neighborhood: company?.neighborhood ?? undefined,
      city: company?.city ?? undefined,
      state: company?.state ?? undefined,
      zipCode: company?.zipCode ?? undefined,
      notes: company?.notes ?? undefined,
      isActive: company?.isActive ?? true,
      origin: company?.origin ?? undefined,
      responsibleId: company?.responsibleId ?? undefined,
      // Sempre nasce com uma região — a padrão (Cachoeiro) quando nenhuma
      // outra foi escolhida (seção "qualquer empresa... virá nessa padrão").
      regionId: company?.regionId ?? regions.find((r) => r.isDefault)?.id ?? undefined,
    },
  });

  const selectedState = watch("state") as string | undefined;
  const cnpjValue = watch("cnpj") as string | undefined;
  const { cities } = useBrMunicipios(selectedState);

  // "ao digitar o CEP já puxa a UF e cidade" — dispara quando o campo
  // completa 8 dígitos; o usuário ainda pode corrigir os campos depois.
  async function handleCepChange(value: string) {
    if (onlyDigits(value).length !== 8) return;
    const address = await fetchAddressByCep(value);
    if (!address) return;
    setValue("state", address.uf, { shouldDirty: true });
    setValue("city", address.localidade, { shouldDirty: true });
    if (address.bairro) setValue("neighborhood", address.bairro, { shouldDirty: true });
    if (address.logradouro) setValue("addressLine", address.logradouro, { shouldDirty: true });
  }

  // Lupa ao lado do CNPJ: consulta a Receita Federal e preenche tudo que o
  // form tiver campo pra receber — usuário ainda pode corrigir depois.
  function handleCnpjLookup(result: CnpjLookupResult) {
    setValue("legalName", result.razaoSocial, { shouldDirty: true });
    if (result.nomeFantasia) setValue("tradeName", result.nomeFantasia, { shouldDirty: true });
    if (result.telefone) {
      const digits = onlyDigits(result.telefone);
      if (isValidPhone(digits)) setValue("phone", digits, { shouldDirty: true });
    }
    if (result.email) setValue("email", result.email, { shouldDirty: true });
    if (result.cep) setValue("zipCode", maskCEP(result.cep), { shouldDirty: true });
    if (result.uf) setValue("state", result.uf, { shouldDirty: true });
    if (result.municipio) setValue("city", result.municipio, { shouldDirty: true });
    if (result.bairro) setValue("neighborhood", result.bairro, { shouldDirty: true });
    if (result.logradouro) setValue("addressLine", result.logradouro, { shouldDirty: true });
    if (result.numero) setValue("addressNumber", result.numero, { shouldDirty: true });
    if (result.complemento) setValue("complement", result.complemento, { shouldDirty: true });
  }

  async function submit(data: CompanyFormInput) {
    const result =
      mode === "create"
        ? await createCompany(data)
        : await updateCompany(company!.id, data);

    if (result.status === "duplicate") {
      setDuplicate(result.company);
      return;
    }

    if (result.status === "error") {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "create" ? "Empresa criada." : "Empresa atualizada.");
    onSuccess(result.id);
  }

  return (
    <>
      <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="legalName">Razão social</Label>
            <Input id="legalName" {...register("legalName")} />
            {errors.legalName && (
              <p className="text-xs text-destructive">{errors.legalName.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tradeName">Nome fantasia</Label>
            <Input id="tradeName" {...register("tradeName")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cnpj">CNPJ</Label>
            <div className="flex items-center gap-1.5">
              <MaskedInput
                id="cnpj"
                mask={maskCNPJ}
                placeholder="00.000.000/0000-00"
                className="flex-1"
                {...register("cnpj")}
              />
              <CnpjLookupButton cnpj={cnpjValue} onResult={handleCnpjLookup} />
            </div>
            {errors.cnpj && <p className="text-xs text-destructive">{errors.cnpj.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" placeholder="(11) 3456-7890" {...register("phone")} />
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
            <Label htmlFor="website">Site</Label>
            <Input id="website" placeholder="www.empresa.com.br" {...register("website")} />
            {errors.website && (
              <p className="text-xs text-destructive">{errors.website.message}</p>
            )}
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

          <div className="flex flex-col gap-1.5">
            <Label>Região</Label>
            <Controller
              control={control}
              name="regionId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: region.color }}
                          />
                          {region.name}
                        </span>
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
              Empresa ativa
            </Label>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="addressLine">Endereço</Label>
            <Input id="addressLine" placeholder="Rua, avenida..." {...register("addressLine")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressNumber">Número</Label>
            <Input id="addressNumber" {...register("addressNumber")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="complement">Complemento</Label>
            <Input id="complement" {...register("complement")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input id="neighborhood" {...register("neighborhood")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zipCode">CEP</Label>
            <MaskedInput
              id="zipCode"
              mask={maskCEP}
              placeholder="00000-000"
              {...register("zipCode", {
                onChange: (e) => void handleCepChange(e.target.value),
              })}
            />
            {errors.zipCode && <p className="text-xs text-destructive">{errors.zipCode.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Estado</Label>
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => {
                    field.onChange(v === "none" ? undefined : v);
                    setValue("city", undefined);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    {BR_STATES.map((s) => (
                      <SelectItem key={s.uf} value={s.uf}>
                        {s.name} ({s.uf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Cidade</Label>
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                  disabled={!selectedState}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={selectedState ? "Selecione" : "Escolha a UF primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informada</SelectItem>
                    {cities.map((cityName) => (
                      <SelectItem key={cityName} value={cityName}>
                        {cityName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : mode === "create" ? "Criar empresa" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </form>

      <CompanyDuplicateDialog
        duplicate={duplicate}
        onClose={() => setDuplicate(null)}
        onUseExisting={() => {
          if (duplicate) onSuccess(duplicate.id);
          setDuplicate(null);
        }}
      />
    </>
  );
}

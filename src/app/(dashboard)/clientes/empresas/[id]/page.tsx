import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ShieldAlert, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatCNPJ, formatDate, formatPhone } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { ACTIVE_STATUS_LABEL, ACTIVE_STATUS_TONE, ORIGIN_LABELS } from "@/features/companies/labels";
import { CompanyDetailActions } from "@/features/companies/company-detail-actions";
import { CompanyTimeline } from "@/features/companies/company-timeline";
import { canEditCompany } from "@/features/companies/permissions";
import { CompanyCustomerStatus } from "@/features/companies/company-customer-status";
import { getCompany, getCompanyActivities } from "@/features/companies/queries";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { listAssignableUsers } from "@/features/leads/queries";
import { listRegions } from "@/features/regions/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "clientes", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de Clientes."
      />
    );
  }

  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  const canEdit = canEditCompany(session.user.role, session.user.id, company);
  if (!canEdit) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Esta empresa pertence a outro responsável."
      />
    );
  }

  const [assignableUsers, activities, regions] = await Promise.all([
    listAssignableUsers(),
    getCompanyActivities(company.id),
    listRegions(),
  ]);

  const activeKey = String(company.isActive) as "true" | "false";
  const address = [company.addressLine, company.addressNumber].filter(Boolean).join(", ");
  const addressLine2 = [company.neighborhood, company.city, company.state]
    .filter(Boolean)
    .join(" · ");

  const cnaesSecundarios = parseJsonArray<{ codigo: string; descricao: string }>(company.cnaesSecundarios);
  const socios = parseJsonArray<{ nome: string; qualificacao?: string }>(company.socios);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/clientes/empresas"
        backLabel="Empresas"
        title={
          <>
            {company.tradeName || company.legalName}
            <StatusBadge label={ACTIVE_STATUS_LABEL[activeKey]} tone={ACTIVE_STATUS_TONE[activeKey]} />
            {company.deletedAt && <Badge variant="outline">Arquivada</Badge>}
            <CompanyCustomerStatus
              companyId={company.id}
              companyName={company.tradeName || company.legalName}
              customer={company.customer}
              canConvert={!company.deletedAt}
            />
          </>
        }
        description={`${company.tradeName ? `${company.legalName} · ` : ""}${company.responsible?.name ?? "Sem responsável"}`}
        action={<CompanyDetailActions company={company} assignableUsers={assignableUsers} regions={regions} />}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Field label="CNPJ" value={formatCNPJ(company.cnpj)} />
              <Field label="Telefone" value={formatPhone(company.phone)} />
              <Field label="WhatsApp" value={formatPhone(company.whatsapp)} />
              <Field label="E-mail" value={company.email ?? "—"} />
              <Field label="Site" value={company.website ?? "—"} />
              <Field label="Origem" value={company.origin ? ORIGIN_LABELS[company.origin] : "—"} />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Região</p>
                {company.region ? (
                  <p className="mt-1 flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: company.region.color }}
                    />
                    {company.region.name}
                  </p>
                ) : (
                  <p className="mt-1">—</p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Endereço</p>
                <p className="mt-1 text-sm">
                  {address || addressLine2 || company.zipCode
                    ? [address, addressLine2, company.zipCode].filter(Boolean).join(" — ")
                    : "—"}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{company.notes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          {(company.cnae || company.foundedAt || company.capitalSocialCents != null || company.taxStatus) && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Dados da Receita Federal</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <Field label="Situação cadastral" value={company.taxStatus ?? "—"} />
                  <Field
                    label="Data da situação"
                    value={company.taxStatusDate ? formatDate(company.taxStatusDate) : "—"}
                  />
                  <Field label="Data de abertura" value={company.foundedAt ? formatDate(company.foundedAt) : "—"} />
                  <Field
                    label="Capital social"
                    value={
                      company.capitalSocialCents != null
                        ? formatMoneyCents(Number(company.capitalSocialCents))
                        : "—"
                    }
                  />
                  <Field label="Natureza jurídica" value={company.naturezaJuridica ?? "—"} />
                  <Field label="Porte" value={company.porte ?? "—"} />
                  <div className="col-span-2">
                    <Field
                      label="CNAE principal"
                      value={[company.cnae, company.cnaeDescricao].filter(Boolean).join(" — ") || "—"}
                    />
                  </div>
                  <Field label="Optante pelo Simples Nacional" value={formatYesNo(company.optanteSimples)} />
                  <Field label="Optante pelo MEI" value={formatYesNo(company.optanteMei)} />
                </div>

                {company.receitaEnrichedAt && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">CNAEs secundários</p>
                    {cnaesSecundarios.length > 0 ? (
                      <ul className="flex flex-col gap-1 text-sm">
                        {cnaesSecundarios.map((c) => (
                          <li key={c.codigo}>
                            <span className="text-muted-foreground">{c.codigo}</span> — {c.descricao}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum CNAE secundário.</p>
                    )}
                  </div>
                )}

                {company.receitaEnrichedAt && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sócios e administradores</p>
                    {socios.length > 0 ? (
                      <ul className="flex flex-col gap-1 text-sm">
                        {socios.map((s, i) => (
                          <li key={i}>
                            {s.nome}
                            {s.qualificacao && <span className="text-muted-foreground"> — {s.qualificacao}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Esta empresa não possui sócios.</p>
                    )}
                  </div>
                )}

                {company.receitaEnrichedAt && (
                  <p className="text-xs text-muted-foreground">
                    Consultado na Receita Federal em {formatDate(company.receitaEnrichedAt)}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card size="sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Contatos ({company.contacts.length})</CardTitle>
              <ContactFormDialog
                mode="create"
                companyOptions={[
                  { id: company.id, legalName: company.legalName, tradeName: company.tradeName },
                ]}
                assignableUsers={assignableUsers}
                defaultCompanyId={company.id}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="size-4" />
                    Novo contato
                  </Button>
                }
              />
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 ? (
                <EmptyState
                  icon={UserRound}
                  title="Nenhum contato vinculado"
                  description="Contatos criados para esta empresa aparecem aqui."
                />
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {company.contacts.map((contact) => (
                    <li key={contact.id} className="py-2.5 first:pt-0 last:pb-0">
                      <Link
                        href={`/clientes/contatos/${contact.id}`}
                        className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                      >
                        <span className="flex flex-col">
                          <span className="font-medium">{contact.name}</span>
                          {contact.role && (
                            <span className="text-xs text-muted-foreground">{contact.role}</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPhone(contact.phone)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Próximas fases: Oportunidades, Vendas, Instalações e Atendimentos chegam em fases futuras.
          </p>
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

// null = nunca consultado (diferente de false = "não optante").
function formatYesNo(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Sim" : "Não";
}

// cnaesSecundarios/socios são guardados como JSON em texto (mesma convenção
// de Activity.metadata) — nunca deve derrubar a página se vier corrompido.
function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

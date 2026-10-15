import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Pencil,
  Plus,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TabPills } from "@/components/tab-pills";
import { formatCNPJ, formatDate, formatPhone } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { ContactFormDialog } from "@/features/contacts/contact-form-dialog";
import { CONTACT_LINK_TYPE_LABELS } from "@/features/contacts/labels";
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_TONE,
} from "@/features/customers/labels";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { CustomerTimeline } from "@/features/customers/customer-timeline";
import { canEditCustomer } from "@/features/customers/permissions";
import {
  getCustomer,
  getCustomerActivities,
} from "@/features/customers/queries";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { CustomerCulturePanel } from "@/features/customers/culture/customer-culture-panel";
import { getCustomerCulture } from "@/features/customers/culture/queries";
import {
  INSTALLATION_STATUS_LABELS,
  INSTALLATION_STATUS_TONE,
} from "@/features/installations/labels";
import { listAssignableUsers } from "@/features/leads/queries";
import { listRegions } from "@/features/regions/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(
    session.user.id,
  );

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
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const canEdit = canEditCustomer(session.user.role, session.user.id, customer);
  if (!canEdit) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Este cliente pertence a outro responsável."
      />
    );
  }

  const tab = (await searchParams).aba === "cultura" ? "cultura" : "geral";
  const [
    assignableUsers,
    activities,
    atendimentoAssignableUsers,
    regions,
    culture,
  ] = await Promise.all([
    listAssignableUsers(),
    getCustomerActivities(customer.id),
    listAtendimentoAssignableUsers(),
    listRegions(),
    getCustomerCulture(customer.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/clientes"
        backLabel="Clientes"
        title={
          <>
            {getCustomerDisplayName(customer)}
            <StatusBadge
              label={CUSTOMER_STATUS_LABELS[customer.status]}
              tone={CUSTOMER_STATUS_TONE[customer.status]}
            />
          </>
        }
        description={`Cliente desde ${formatDate(customer.becameCustomerAt)} · ${customer.responsible?.name ?? "Sem responsável"}`}
        tabs={
          <TabPills
            label="Seções do cliente"
            tabs={[
              {
                label: "Visão geral",
                href: `/clientes/${customer.id}`,
                active: tab === "geral",
              },
              {
                label: "Cultura/Modelo",
                href: `/clientes/${customer.id}?aba=cultura`,
                active: tab === "cultura",
              },
            ]}
          />
        }
        action={
          <CustomerFormDialog
            customer={customer}
            assignableUsers={assignableUsers}
            regions={regions}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="size-4" />
                Editar
              </Button>
            }
          />
        }
      />

      {tab === "cultura" && culture ? (
        <CustomerCulturePanel culture={culture} canEdit={canEdit} />
      ) : (
        <>
          {culture?.alert && (
            <Link
              href={`/clientes/${customer.id}?aba=cultura`}
              className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-sm hover:bg-amber-500/15"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <span className="font-semibold">Atenção: </span>
                {culture.alert}
              </span>
            </Link>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="flex flex-col gap-3 lg:col-span-2">
              <Card size="sm">
                <CardHeader>
                  <CardTitle>Informações</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  {customer.company && (
                    <>
                      <Field
                        label="Empresa"
                        value={
                          customer.company.tradeName ||
                          customer.company.legalName
                        }
                        href={`/clientes/empresas/${customer.company.id}`}
                      />
                      <Field
                        label="CNPJ"
                        value={formatCNPJ(customer.company.cnpj)}
                      />
                      <Field
                        label="Telefone"
                        value={formatPhone(customer.company.phone)}
                      />
                    </>
                  )}
                  {customer.contact && (
                    <Field
                      label="Contato"
                      value={customer.contact.name}
                      href={`/clientes/contatos/${customer.contact.id}`}
                    />
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Região
                    </p>
                    {(customer.region ?? customer.company?.region) ? (
                      <p className="mt-1 flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: (customer.region ??
                              customer.company?.region)!.color,
                          }}
                        />
                        {(customer.region ?? customer.company?.region)!.name}
                      </p>
                    ) : (
                      <p className="mt-1">—</p>
                    )}
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Observações
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {customer.notes || "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {customer.company && (
                <Card size="sm">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>
                      Contatos ({customer.company.contacts.length})
                    </CardTitle>
                    <ContactFormDialog
                      mode="create"
                      companyOptions={[
                        {
                          id: customer.company.id,
                          legalName: customer.company.legalName,
                          tradeName: customer.company.tradeName,
                        },
                      ]}
                      assignableUsers={assignableUsers}
                      defaultCompanyId={customer.company.id}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Plus className="size-4" />
                          Novo contato
                        </Button>
                      }
                    />
                  </CardHeader>
                  <CardContent>
                    {customer.company.contacts.length === 0 ? (
                      <EmptyState
                        icon={UserRound}
                        title="Nenhum contato vinculado"
                        description="Contatos criados para esta empresa aparecem aqui."
                      />
                    ) : (
                      <ul className="flex flex-col divide-y divide-border">
                        {customer.company.contacts.map((contact) => (
                          <li
                            key={contact.id}
                            className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                          >
                            <Link
                              href={`/clientes/contatos/${contact.id}`}
                              className="flex min-w-0 flex-col hover:text-primary"
                            >
                              <span className="flex items-center gap-1.5 text-sm font-medium">
                                {contact.name}
                                {contact.isPrimaryContact && (
                                  <StatusBadge label="Principal" tone="info" />
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {[
                                  contact.role,
                                  contact.linkType
                                    ? CONTACT_LINK_TYPE_LABELS[contact.linkType]
                                    : null,
                                  formatPhone(
                                    contact.phone ?? contact.whatsapp,
                                  ),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </Link>
                            <AtendimentoButton
                              entityType="CUSTOMER_CONTACT"
                              entityId={contact.id}
                              assignableUsers={atendimentoAssignableUsers}
                              size="sm"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Vendas ({customer.sales.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.sales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma venda ainda.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border">
                      {customer.sales.map((sale) => (
                        <li
                          key={sale.id}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <Link
                            href={`/vendas/${sale.id}`}
                            className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                          >
                            <span>{sale.opportunity.title}</span>
                            <span className="font-medium tabular-nums">
                              {formatMoneyCents(sale.amountCents)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>
                    Instalações ({customer.installations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.installations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma instalação ainda.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border">
                      {customer.installations.map((installation) => (
                        <li
                          key={installation.id}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <Link
                            href={`/instalacoes/${installation.id}`}
                            className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                          >
                            <span>{installation.stage.name}</span>
                            <StatusBadge
                              label={
                                INSTALLATION_STATUS_LABELS[installation.status]
                              }
                              tone={
                                INSTALLATION_STATUS_TONE[installation.status]
                              }
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Histórico</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerTimeline activities={activities} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {href ? (
        <Link href={href} className="mt-1 block text-primary hover:underline">
          {value}
        </Link>
      ) : (
        <p className="mt-1">{value}</p>
      )}
    </div>
  );
}

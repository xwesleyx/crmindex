import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Headset, MessageSquare, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getInitials } from "@/components/entity-avatar";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { formatCNPJ, formatDate, formatDateTime, formatDurationMinutes, formatPhone } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { onlyDigits, withBrazilCountryCode } from "@/lib/validators";
import { CONVERSATION_QUEUE_LABELS, getConversationDisplayStatus } from "@/features/atendimento/labels";
import { listCompanyOptions } from "@/features/companies/queries";
import {
  ACTIVE_STATUS_LABEL,
  ACTIVE_STATUS_TONE,
  CONTACT_LINK_TYPE_LABELS,
  ORIGIN_LABELS,
} from "@/features/contacts/labels";
import { ContactDetailActions } from "@/features/contacts/contact-detail-actions";
import { ContactNameEditor } from "@/features/contacts/contact-name-editor";
import { ContactTimeline } from "@/features/contacts/contact-timeline";
import { canEditContact } from "@/features/contacts/permissions";
import {
  CONTACT_RECENT_CONVERSATIONS_LIMIT,
  getContact,
  getContactActivities,
  getContactOverview,
} from "@/features/contacts/queries";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_TONE } from "@/features/customers/labels";
import { INSTALLATION_STATUS_LABELS, INSTALLATION_STATUS_TONE } from "@/features/installations/labels";
import { listAssignableUsers } from "@/features/leads/queries";
import { OPPORTUNITY_STATUS_LABELS, OPPORTUNITY_STATUS_TONE } from "@/features/opportunities/labels";
import { SALE_STATUS_LABELS, SALE_STATUS_TONE } from "@/features/sales/labels";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);
  const canSee = (module: Parameters<typeof isModuleVisible>[1]) =>
    isModuleVisible(session.user.role, module, permissionOverrides);

  if (!canSee("clientes")) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de Clientes."
      />
    );
  }

  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) notFound();

  const canEdit = canEditContact(session.user.role, session.user.id, contact);
  if (!canEdit) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Este contato pertence a outro responsável."
      />
    );
  }

  const [assignableUsers, companyOptions, activities, overview] = await Promise.all([
    listAssignableUsers(),
    listCompanyOptions(),
    getContactActivities(contact.id),
    getContactOverview(contact.id),
  ]);
  const { company, customer, opportunities, sales, installations, conversations, counts } = overview;

  const canSeeAtendimento = canSee("atendimento");
  const canSeeCrm = canSee("crm");
  const canSeeInstalacoes = canSee("instalacoes");

  const activeKey = String(contact.isActive) as "true" | "false";
  const companyLabel = company ? company.tradeName || company.legalName : null;
  const whatsappDigits = contact.whatsapp ? withBrazilCountryCode(onlyDigits(contact.whatsapp)) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/clientes/contatos"
        backLabel="Contatos"
        title={
          <>
            {/* Foto do WhatsApp (só pela Neonize; sem foto/privada, cai nas
                iniciais) — mesma rota usada no painel do Atendimento. */}
            <Avatar className="size-14">
              <AvatarImage src={`/api/atendimento/contact-photo/${contact.id}`} alt={`Foto de ${contact.name}`} />
              <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <ContactNameEditor contactId={contact.id} name={contact.name} whatsappName={contact.whatsappName} />
            <StatusBadge label={ACTIVE_STATUS_LABEL[activeKey]} tone={ACTIVE_STATUS_TONE[activeKey]} />
            {contact.isPrimaryContact && <StatusBadge label="Contato principal" tone="info" />}
            {!contact.identified && <StatusBadge label="Não identificado" tone="warning" />}
            {contact.deletedAt && <Badge variant="outline">Arquivado</Badge>}
          </>
        }
        description={[contact.role, contact.department, companyLabel].filter(Boolean).join(" · ")}
        action={
          <ContactDetailActions
            contact={contact}
            companyOptions={companyOptions}
            assignableUsers={assignableUsers}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Atendimentos" value={counts.conversations} />
        <Stat label="Oportunidades" value={counts.opportunities} />
        <Stat label="Vendas" value={counts.sales} />
        <Stat label="Instalações" value={counts.installations} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Field label="Telefone" value={formatPhone(contact.phone)} />
              <Field
                label="WhatsApp"
                value={formatPhone(contact.whatsapp)}
                href={whatsappDigits ? `https://wa.me/${whatsappDigits}` : undefined}
                external
              />
              <Field
                label="E-mail"
                value={contact.email ?? "—"}
                href={contact.email ? `mailto:${contact.email}` : undefined}
                external
              />
              <Field label="Cargo" value={contact.role ?? "—"} />
              <Field label="Departamento" value={contact.department ?? "—"} />
              <Field label="Vínculo" value={contact.linkType ? CONTACT_LINK_TYPE_LABELS[contact.linkType] : "—"} />
              <Field
                label="Empresa"
                value={companyLabel ?? "—"}
                href={company ? `/clientes/empresas/${company.id}` : undefined}
              />
              <Field label="Origem" value={contact.origin ? ORIGIN_LABELS[contact.origin] : "—"} />
              <Field label="Responsável" value={contact.responsible?.name ?? "Sem responsável"} />
              <Field label="Última interação" value={formatDateTime(contact.lastInteractionAt)} />
              <Field label="Cadastrado em" value={formatDateTime(contact.createdAt)} />
              <Field label="Atualizado em" value={formatDateTime(contact.updatedAt)} />
              {counts.leadsConvertedTo > 0 && (
                <Field label="Leads convertidos" value={String(counts.leadsConvertedTo)} />
              )}
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{contact.notes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headset className="size-4" />
                Últimos atendimentos
                {counts.conversations > CONTACT_RECENT_CONVERSATIONS_LIMIT && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({CONTACT_RECENT_CONVERSATIONS_LIMIT} mais recentes de {counts.conversations})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhum atendimento com este contato ainda.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {conversations.map((conversation) => {
                    const display = getConversationDisplayStatus(conversation);
                    const durationMinutes = conversation.closedAt
                      ? Math.round((conversation.closedAt.getTime() - conversation.createdAt.getTime()) / 60000)
                      : null;
                    const body = (
                      <div className="flex flex-col gap-1 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{formatDateTime(conversation.createdAt)}</span>
                            <StatusBadge label={display.label} tone={display.tone} />
                            {conversation.queue && (
                              <Badge variant="outline">{CONVERSATION_QUEUE_LABELS[conversation.queue]}</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {conversation.assignee?.name ?? "Sem responsável"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3" />
                            {conversation._count.messages} mensage{conversation._count.messages === 1 ? "m" : "ns"}
                          </span>
                          <span>Última mensagem: {formatDateTime(conversation.lastMessageAt)}</span>
                          {durationMinutes !== null && <span>Duração: {formatDurationMinutes(durationMinutes)}</span>}
                        </div>
                        {conversation.lastMessagePreview && (
                          <p className="truncate text-xs text-muted-foreground italic">
                            “{conversation.lastMessagePreview}”
                          </p>
                        )}
                      </div>
                    );
                    return (
                      <li key={conversation.id}>
                        {canSeeAtendimento ? (
                          <Link href={`/atendimento/${conversation.id}`} className="block hover:bg-muted">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {company && (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-4" />
                  Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Field label="Razão social" value={company.legalName} href={`/clientes/empresas/${company.id}`} />
                <Field label="Nome fantasia" value={company.tradeName ?? "—"} />
                <Field label="CNPJ" value={company.cnpj ? formatCNPJ(company.cnpj) : "—"} />
                <Field label="Telefone" value={formatPhone(company.phone)} />
                <Field
                  label="E-mail"
                  value={company.email ?? "—"}
                  href={company.email ? `mailto:${company.email}` : undefined}
                  external
                />
                <Field label="Cidade" value={[company.city, company.state].filter(Boolean).join(" / ") || "—"} />
                {company.taxStatus && <Field label="Situação na Receita" value={company.taxStatus} />}
              </CardContent>
            </Card>
          )}

          {(customer || opportunities.length > 0 || sales.length > 0 || installations.length > 0) && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Comercial</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                {customer && (
                  <RelatedSection title="Cliente">
                    <RelatedRow
                      href={`/clientes/${customer.id}`}
                      title={`Cliente desde ${formatDate(customer.becameCustomerAt)}`}
                      detail={customer.region?.name}
                      badge={
                        <StatusBadge
                          label={CUSTOMER_STATUS_LABELS[customer.status]}
                          tone={CUSTOMER_STATUS_TONE[customer.status]}
                        />
                      }
                    />
                  </RelatedSection>
                )}

                {opportunities.length > 0 && (
                  <RelatedSection title="Oportunidades" total={counts.opportunities} shown={opportunities.length}>
                    {opportunities.map((opportunity) => (
                      <RelatedRow
                        key={opportunity.id}
                        href={canSeeCrm ? `/crm/oportunidades/${opportunity.id}` : undefined}
                        title={opportunity.title}
                        detail={`${opportunity.stage.name} · ${formatMoneyCents(opportunity.estimatedValueCents)}`}
                        badge={
                          <StatusBadge
                            label={OPPORTUNITY_STATUS_LABELS[opportunity.status]}
                            tone={OPPORTUNITY_STATUS_TONE[opportunity.status]}
                          />
                        }
                      />
                    ))}
                  </RelatedSection>
                )}

                {sales.length > 0 && (
                  <RelatedSection title="Vendas" total={counts.sales} shown={sales.length}>
                    {sales.map((sale) => (
                      <RelatedRow
                        key={sale.id}
                        href={canSeeCrm ? `/vendas/${sale.id}` : undefined}
                        title={formatMoneyCents(sale.amountCents)}
                        detail={formatDate(sale.soldAt)}
                        badge={<StatusBadge label={SALE_STATUS_LABELS[sale.status]} tone={SALE_STATUS_TONE[sale.status]} />}
                      />
                    ))}
                  </RelatedSection>
                )}

                {installations.length > 0 && (
                  <RelatedSection title="Instalações" total={counts.installations} shown={installations.length}>
                    {installations.map((installation) => (
                      <RelatedRow
                        key={installation.id}
                        href={canSeeInstalacoes ? `/instalacoes/${installation.id}` : undefined}
                        title={installation.stage.name}
                        detail={
                          installation.scheduledAt
                            ? `Agendada para ${formatDateTime(installation.scheduledAt)}`
                            : `Criada em ${formatDate(installation.createdAt)}`
                        }
                        badge={
                          <StatusBadge
                            label={INSTALLATION_STATUS_LABELS[installation.status]}
                            tone={INSTALLATION_STATUS_TONE[installation.status]}
                          />
                        }
                      />
                    ))}
                  </RelatedSection>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card size="sm" className="h-fit">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {href ? (
        <Link
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer" : undefined}
          className="mt-1 block truncate text-primary hover:underline"
        >
          {value}
        </Link>
      ) : (
        <p className="mt-1 break-words">{value}</p>
      )}
    </div>
  );
}

function RelatedSection({
  title,
  total,
  shown,
  children,
}: {
  title: string;
  total?: number;
  shown?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase">
        {title}
        {total !== undefined && shown !== undefined && total > shown && (
          <span className="ml-1 font-normal normal-case">
            ({shown} mais recentes de {total})
          </span>
        )}
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">{children}</ul>
    </div>
  );
}

function RelatedRow({
  href,
  title,
  detail,
  badge,
}: {
  href?: string;
  title: string;
  detail?: string | null;
  badge: ReactNode;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
      </div>
      {badge}
    </div>
  );
  return <li>{href ? <Link href={href} className="block hover:bg-muted">{content}</Link> : content}</li>;
}

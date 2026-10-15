import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { MoneyDisplay } from "@/components/money-display";
import { formatDate } from "@/lib/format";
import { AtendimentoButton } from "@/features/atendimento/atendimento-button";
import { listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { getCustomerDisplayName } from "@/features/customers/utils";
import { canEditSale } from "@/features/sales/permissions";
import { getSale, getSaleActivities } from "@/features/sales/queries";
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  SALE_STATUS_TONE,
} from "@/features/sales/labels";
import { SaleFormDialog } from "@/features/sales/sale-form-dialog";
import { SaleTimeline } from "@/features/sales/sale-timeline";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (!isModuleVisible(session.user.role, "crm", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso ao módulo de CRM."
      />
    );
  }

  const { id } = await params;
  const sale = await getSale(id);
  if (!sale) notFound();

  if (!canEditSale(session.user.role, session.user.id, sale)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Esta venda pertence a outro responsável."
      />
    );
  }

  const [activities, atendimentoAssignableUsers] = await Promise.all([
    getSaleActivities(sale.id),
    listAtendimentoAssignableUsers(),
  ]);
  const canEdit = canEditSale(session.user.role, session.user.id, sale);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/vendas"
        backLabel="Vendas"
        title={
          <>
            Venda #{sale.id.slice(-6).toUpperCase()}
            <StatusBadge label={SALE_STATUS_LABELS[sale.status]} tone={SALE_STATUS_TONE[sale.status]} />
          </>
        }
        description={
          <span className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-1.5">
              <MoneyDisplay cents={sale.amountCents} size="xl" />
              {sale.recurringAmountCents > 0 && (
                <span className="text-sm text-muted-foreground">
                  + <MoneyDisplay cents={sale.recurringAmountCents} size="sm" muted /> /mês
                </span>
              )}
            </span>
            <span>
              {formatDate(sale.soldAt)} · {sale.owner?.name ?? "Sem responsável"}
            </span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {(sale.contactId || sale.companyId) && (
              <AtendimentoButton
                entityType="SALE"
                entityId={sale.id}
                defaultQueue="COMERCIAL"
                assignableUsers={atendimentoAssignableUsers}
                size="sm"
              />
            )}
            {canEdit && (
              <SaleFormDialog
                sale={sale}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" />
                    Editar
                  </Button>
                }
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Field
                label="Oportunidade"
                value={sale.opportunity.title}
                href={`/crm/oportunidades/${sale.opportunity.id}`}
              />
              <Field
                label="Cliente"
                value={getCustomerDisplayName(sale.customer)}
                href={`/clientes/${sale.customer.id}`}
              />
              {sale.installation && (
                <Field
                  label="Instalação"
                  value="Ver instalação"
                  href={`/instalacoes/${sale.installation.id}`}
                />
              )}
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{sale.notes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Valor da venda</p>
                <MoneyDisplay cents={sale.amountCents} size="md" className="mt-1" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Desconto</p>
                <MoneyDisplay cents={sale.discountCents} size="md" className="mt-1" muted />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Valor recorrente</p>
                <MoneyDisplay cents={sale.recurringAmountCents} size="md" className="mt-1" />
              </div>
              <Field
                label="Forma de pagamento"
                value={sale.paymentMethod ? PAYMENT_METHOD_LABELS[sale.paymentMethod] : "—"}
              />
            </CardContent>
          </Card>
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <SaleTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
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

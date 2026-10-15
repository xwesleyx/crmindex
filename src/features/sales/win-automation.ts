import type { Prisma, Priority } from "@prisma/client";

import { logActivity } from "@/lib/activity";
import { listChecklistTemplateItems } from "@/features/checklist-templates/queries";
import { getDefaultRegionId } from "@/features/regions/queries";

// Erro de negócio esperado (permissão, dado faltando) — o chamador converte
// em `{ success: false, error: message }` sem logar como falha inesperada.
// Lançar (em vez de retornar um erro) é o que faz o `$transaction` do Prisma
// reverter tudo automaticamente (seção 30/31 do escopo).
export class AutomationError extends Error {}

type OpportunityForAutomation = {
  id: string;
  companyId: string | null;
  contactId: string | null;
  ownerId: string | null;
  estimatedValueCents: number;
  recurringValueCents: number;
  priority: Priority;
};

// Núcleo da automação "Venda Ganha" (seção 12 do escopo): dado um client de
// transação já aberto e a oportunidade (já confirmada como WON pelo
// chamador), localiza-ou-cria Customer → Sale → Installation → checklist,
// nessa ordem, sempre dentro da MESMA transação. Idempotente: rodar de novo
// para a mesma oportunidade reaproveita os registros já criados (seção 13) —
// as constraints @unique em Customer.companyId/contactId, Sale.opportunityId
// e Installation.saleId garantem isso mesmo sob concorrência, não só a
// checagem "find antes de create" abaixo.
export async function runOpportunityWonAutomation(
  tx: Prisma.TransactionClient,
  opportunity: OpportunityForAutomation,
  userId: string
) {
  if (!opportunity.companyId && !opportunity.contactId) {
    throw new AutomationError(
      "A oportunidade precisa estar vinculada a um contato ou empresa para virar cliente."
    );
  }

  // 1. Customer — localizar ou criar (não duplicar por Company/Contact).
  let customer = opportunity.companyId
    ? await tx.customer.findUnique({ where: { companyId: opportunity.companyId } })
    : await tx.customer.findUnique({ where: { contactId: opportunity.contactId! } });

  let customerCreated = false;
  if (!customer) {
    // "qualquer... cliente... virá nessa padrão" — a automação também não
    // pede região, então já nasce com a padrão (Cachoeiro).
    customer = await tx.customer.create({
      data: {
        companyId: opportunity.companyId,
        contactId: opportunity.contactId,
        responsibleId: opportunity.ownerId,
        regionId: await getDefaultRegionId(tx),
      },
    });
    customerCreated = true;
    await logActivity(
      {
        userId,
        action: "customer.created_from_opportunity",
        entityType: "Customer",
        entityId: customer.id,
        metadata: { opportunityId: opportunity.id },
      },
      tx
    );
  }

  // 2. Sale — no máximo uma por oportunidade (Sale.opportunityId é @unique).
  let sale = await tx.sale.findUnique({ where: { opportunityId: opportunity.id } });
  let saleCreated = false;
  if (!sale) {
    sale = await tx.sale.create({
      data: {
        opportunityId: opportunity.id,
        customerId: customer.id,
        companyId: opportunity.companyId,
        contactId: opportunity.contactId,
        ownerId: opportunity.ownerId,
        amountCents: opportunity.estimatedValueCents,
        recurringAmountCents: opportunity.recurringValueCents,
        status: "CONFIRMADA",
      },
    });
    saleCreated = true;
    await logActivity(
      {
        userId,
        action: "sale.created_from_opportunity",
        entityType: "Sale",
        entityId: sale.id,
        metadata: { opportunityId: opportunity.id, customerId: customer.id, amountCents: sale.amountCents },
      },
      tx
    );
  }

  // 3. Installation — no máximo uma por venda (Installation.saleId é @unique).
  let installation = await tx.installation.findUnique({ where: { saleId: sale.id } });
  let installationCreated = false;
  if (!installation) {
    const firstStage = await tx.kanbanStage.findFirst({
      where: { board: "INSTALLATION", active: true },
      orderBy: { order: "asc" },
    });
    if (!firstStage) {
      throw new AutomationError(
        "Nenhuma etapa configurada para o Kanban de instalação. Rode o seed do banco."
      );
    }

    installation = await tx.installation.create({
      data: {
        saleId: sale.id,
        customerId: customer.id,
        companyId: opportunity.companyId,
        contactId: opportunity.contactId,
        opportunityId: opportunity.id,
        responsibleId: opportunity.ownerId,
        priority: opportunity.priority,
        stageId: firstStage.id,
      },
    });
    installationCreated = true;

    // 4. Checklist inicial — só na criação, nunca reaplicado num rerun.
    // Template editável em Configurações > Checklist de Instalação (copiado
    // pra cá, não referenciado — mudar o template depois não afeta esta
    // instalação).
    const template = await listChecklistTemplateItems(tx);
    if (template.length > 0) {
      await tx.installationChecklistItem.createMany({
        data: template.map((item) => ({
          installationId: installation!.id,
          label: item.label,
          order: item.order,
          required: item.required,
        })),
      });
    }

    await logActivity(
      {
        userId,
        action: "installation.created_from_sale",
        entityType: "Installation",
        entityId: installation.id,
        metadata: { saleId: sale.id, customerId: customer.id },
      },
      tx
    );
  }

  // 5. Se a oportunidade nasceu de um atendimento (Conversation.opportunityId
  // — Fase 6, seção 4), propaga o Customer pra conversa também: "a mesma
  // conversa poderá continuar relacionada ao histórico comercial". Sempre um
  // no-op fora do fluxo de atendimento (nenhuma conversa aponta pra esta
  // oportunidade).
  await tx.conversation.updateMany({
    where: { opportunityId: opportunity.id },
    data: { customerId: customer.id },
  });

  return {
    customer,
    sale,
    installation,
    created: { customer: customerCreated, sale: saleCreated, installation: installationCreated },
  };
}

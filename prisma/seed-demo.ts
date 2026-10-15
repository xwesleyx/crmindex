// Popula dados de DEMONSTRAÇÃO — só para visualizar Kanban/Dashboard cheios
// em ambiente local. NUNCA rodar em produção (guard abaixo recusa se
// NODE_ENV=production). Todo registro criado aqui é marcado com o prefixo
// "[DEMO] " no nome/título, o que serve tanto para reconhecer visualmente
// os dados fictícios na UI quanto para limpá-los depois — nenhum campo novo
// foi adicionado ao schema só para isso.
//
// Uso:
//   npm run db:seed-demo         cria os dados de demonstração
//   npm run db:seed-demo:clear   remove tudo que foi criado por este script
import { prisma } from "../src/lib/prisma";
import { LOST_STAGE_KEY, WON_STAGE_KEY } from "../src/features/kanban/constants";
import { runOpportunityWonAutomation } from "../src/features/sales/win-automation";
import type { LeadOrigin, LossReason, Priority } from "@prisma/client";

const DEMO_TAG = "[DEMO] ";

const PRIORITIES: Priority[] = ["BAIXA", "NORMAL", "ALTA", "URGENTE"];
const ORIGINS: LeadOrigin[] = ["WHATSAPP", "INDICACAO", "SITE", "GOOGLE", "INSTAGRAM", "PROSPECCAO"];
const LOSS_REASONS: LossReason[] = ["PRECO", "CONCORRENTE", "SEM_INTERESSE", "SEM_ORCAMENTO"];

const DEMO_COMPANIES = [
  "Nortec Engenharia",
  "Bela Vista Alimentos",
  "Grupo Marmore Sul",
  "Horizonte Logística",
  "Cindal Metais",
  "Vila Nova Distribuidora",
  "Planalto Construções",
  "Atlas Sistemas",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function clearDemoData() {
  const opportunities = await prisma.opportunity.findMany({
    where: { title: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const opportunityIds = opportunities.map((o) => o.id);

  const sales = await prisma.sale.findMany({
    where: { opportunityId: { in: opportunityIds } },
    select: { id: true, customerId: true },
  });
  const saleIds = sales.map((s) => s.id);
  const customerIds = [...new Set(sales.map((s) => s.customerId))];

  const installations = await prisma.installation.findMany({
    where: { saleId: { in: saleIds } },
    select: { id: true },
  });
  const installationIds = installations.map((i) => i.id);

  const companies = await prisma.company.findMany({
    where: { tradeName: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const companyIds = companies.map((c) => c.id);

  const contacts = await prisma.contact.findMany({
    where: { name: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const contactIds = contacts.map((c) => c.id);

  const users = await prisma.user.findMany({
    where: { name: { startsWith: DEMO_TAG } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  await prisma.$transaction(async (tx) => {
    await tx.installationChecklistItem.deleteMany({ where: { installationId: { in: installationIds } } });
    await tx.task.deleteMany({ where: { entityType: "Opportunity", entityId: { in: opportunityIds } } });
    await tx.task.deleteMany({ where: { entityType: "Installation", entityId: { in: installationIds } } });
    await tx.installation.deleteMany({ where: { id: { in: installationIds } } });
    await tx.sale.deleteMany({ where: { id: { in: saleIds } } });
    await tx.customer.deleteMany({ where: { id: { in: customerIds } } });
    await tx.opportunity.deleteMany({ where: { id: { in: opportunityIds } } });
    await tx.contact.deleteMany({ where: { id: { in: contactIds } } });
    await tx.company.deleteMany({ where: { id: { in: companyIds } } });
    await tx.activity.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });

  console.log(
    `Dados de demonstração removidos: ${opportunityIds.length} oportunidades, ${companyIds.length} empresas, ${contactIds.length} contatos, ${userIds.length} usuários.`
  );
}

async function seedDemoData() {
  const stages = await prisma.kanbanStage.findMany({
    where: { board: "COMMERCIAL", active: true },
    orderBy: { order: "asc" },
  });
  if (stages.length === 0) {
    throw new Error("Nenhuma etapa do Kanban comercial encontrada. Rode `npm run db:seed` primeiro.");
  }

  const openStages = stages.filter(
    (s) => s.key !== WON_STAGE_KEY && s.key !== LOST_STAGE_KEY
  );
  const wonStage = stages.find((s) => s.key === WON_STAGE_KEY);
  const lostStage = stages.find((s) => s.key === LOST_STAGE_KEY);

  const vendedor = await prisma.user.create({
    data: { name: `${DEMO_TAG}Ana Vendedora`, email: `demo-ana-${Date.now()}@example.invalid`, role: "VENDEDOR", status: "ACTIVE" },
  });
  const gerente = await prisma.user.create({
    data: { name: `${DEMO_TAG}Carlos Gerente`, email: `demo-carlos-${Date.now()}@example.invalid`, role: "GERENTE", status: "ACTIVE" },
  });
  const owners = [vendedor, gerente];

  const companies = [];
  for (const [i, name] of DEMO_COMPANIES.entries()) {
    const company = await prisma.company.create({
      data: {
        legalName: `${DEMO_TAG}${name} Ltda.`,
        tradeName: `${DEMO_TAG}${name}`,
        origin: pick(ORIGINS, i),
        responsibleId: pick(owners, i).id,
      },
    });
    const contact = await prisma.contact.create({
      data: {
        name: `${DEMO_TAG}Contato ${name.split(" ")[0]}`,
        phone: "11999990000",
        companyId: company.id,
        responsibleId: pick(owners, i).id,
        origin: pick(ORIGINS, i),
      },
    });
    companies.push({ company, contact });
  }

  let created = 0;

  // Oportunidades abertas espalhadas pelas etapas intermediárias — dá pra
  // ver contagem/valor/prioridade variados em cada coluna do Kanban.
  for (const [stageIndex, stage] of openStages.entries()) {
    const countInStage = 2 + (stageIndex % 3);
    for (let i = 0; i < countInStage; i++) {
      const seed = stageIndex * 7 + i;
      const { company, contact } = pick(companies, seed);
      const enteredDaysAgo = 1 + (seed % 12);
      await prisma.opportunity.create({
        data: {
          title: `${DEMO_TAG}${company.tradeName!.slice(DEMO_TAG.length)} — projeto ${seed + 1}`,
          companyId: company.id,
          contactId: contact.id,
          ownerId: pick(owners, seed).id,
          stageId: stage.id,
          priority: pick(PRIORITIES, seed),
          estimatedValueCents: (5_000 + (seed % 20) * 3_500) * 100,
          origin: pick(ORIGINS, seed),
          stageEnteredAt: daysAgo(enteredDaysAgo),
          expectedCloseAt: daysAgo(-15),
        },
      });
      created++;
    }
  }

  // Ganhas — roda a automação real (mesma usada em produção) pra gerar
  // Customer → Sale → Installation de verdade, depois só redistribui as
  // datas pros últimos 6 meses (evolução de vendas no dashboard).
  if (wonStage) {
    for (let i = 0; i < 6; i++) {
      const seed = 50 + i;
      const { company, contact } = pick(companies, seed);
      const monthsAgo = i % 6;
      const soldAt = daysAgo(monthsAgo * 30 + (seed % 20));

      const opportunity = await prisma.opportunity.create({
        data: {
          title: `${DEMO_TAG}${company.tradeName!.slice(DEMO_TAG.length)} — venda ${i + 1}`,
          companyId: company.id,
          contactId: contact.id,
          ownerId: pick(owners, seed).id,
          stageId: wonStage.id,
          priority: pick(PRIORITIES, seed),
          estimatedValueCents: (8_000 + (seed % 15) * 4_000) * 100,
          origin: pick(ORIGINS, seed),
          status: "WON",
          wonAt: soldAt,
          stageEnteredAt: soldAt,
        },
      });

      await prisma.$transaction(async (tx) => {
        const { sale } = await runOpportunityWonAutomation(tx, opportunity, pick(owners, seed).id);
        await tx.sale.update({ where: { id: sale.id }, data: { soldAt } });
      });
      created++;
    }
  }

  // Perdidas — pro gráfico de ganhas x perdidas ter os dois lados.
  if (lostStage) {
    for (let i = 0; i < 4; i++) {
      const seed = 80 + i;
      const { company, contact } = pick(companies, seed);
      const lostAt = daysAgo((i % 5) * 30 + 5);
      await prisma.opportunity.create({
        data: {
          title: `${DEMO_TAG}${company.tradeName!.slice(DEMO_TAG.length)} — perdida ${i + 1}`,
          companyId: company.id,
          contactId: contact.id,
          ownerId: pick(owners, seed).id,
          stageId: lostStage.id,
          priority: pick(PRIORITIES, seed),
          estimatedValueCents: (4_000 + (seed % 10) * 2_500) * 100,
          origin: pick(ORIGINS, seed),
          status: "LOST",
          lostAt,
          lostReason: pick(LOSS_REASONS, seed),
          stageEnteredAt: lostAt,
        },
      });
      created++;
    }
  }

  console.log(
    `Dados de demonstração criados: ${companies.length} empresas, ${created} oportunidades (${openStages.length} etapas abertas + ganhas + perdidas), 2 usuários demo.`
  );
  console.log('Tudo prefixado com "[DEMO] " — rode `npm run db:seed-demo:clear` para remover.');
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed de demonstração não pode rodar em produção (NODE_ENV=production).");
  }

  if (process.argv.includes("--clear")) {
    await clearDemoData();
  } else {
    await seedDemoData();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

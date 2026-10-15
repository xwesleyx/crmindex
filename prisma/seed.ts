import bcrypt from "bcryptjs";

import { COMMERCIAL_STAGES, INSTALLATION_STAGES } from "../src/features/kanban/constants";
import { prisma } from "../src/lib/prisma";

// Cria (ou promove) o primeiro administrador a partir de variáveis de
// ambiente — nunca de uma senha fixa no código (seção 6 do escopo).
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";

  if (!email || !password) {
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env antes de rodar o seed. Veja README.md."
    );
  }

  if (password.length < 7) {
    throw new Error("ADMIN_PASSWORD deve ter no mínimo 7 caracteres.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "ACTIVE", passwordHash, name },
    create: { email, name, role: "ADMIN", status: "ACTIVE", passwordHash },
  });

  await prisma.activity.create({
    data: {
      userId: admin.id,
      action: "seed.admin",
      entityType: "User",
      entityId: admin.id,
    },
  });

  console.log(`Administrador pronto: ${admin.email}`);

  for (const stage of COMMERCIAL_STAGES) {
    await prisma.kanbanStage.upsert({
      where: { board_key: { board: "COMMERCIAL", key: stage.key } },
      update: { name: stage.name, order: stage.order, color: stage.color },
      create: {
        board: "COMMERCIAL",
        key: stage.key,
        name: stage.name,
        order: stage.order,
        color: stage.color,
      },
    });
  }

  console.log(`Colunas do Kanban comercial prontas (${COMMERCIAL_STAGES.length}).`);

  for (const stage of INSTALLATION_STAGES) {
    await prisma.kanbanStage.upsert({
      where: { board_key: { board: "INSTALLATION", key: stage.key } },
      update: { name: stage.name, order: stage.order, color: stage.color },
      create: {
        board: "INSTALLATION",
        key: stage.key,
        name: stage.name,
        order: stage.order,
        color: stage.color,
      },
    });
  }

  console.log(`Colunas do Kanban de instalação prontas (${INSTALLATION_STAGES.length}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "@/lib/prisma";

// Único ponto que cria uma linha em Notification — chamado tanto de dentro
// de Server Actions (tasks/actions.ts, ao agendar/reagendar uma tarefa para
// alguém) quanto do agendador de lembretes (instrumentation.ts, fora do
// ciclo de request). Não é "use server" porque não é uma ação disparável
// pelo cliente, só uma função de servidor comum reaproveitada nos dois
// lugares.
export async function createNotification(input: {
  userId: string;
  title: string;
  message: string;
  link?: string | null;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
    },
  });
}

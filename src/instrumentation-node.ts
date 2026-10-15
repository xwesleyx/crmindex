// Agendador do lembrete automático de tarefa/agenda (seção "faltando uns 30
// minutos antes como padrão, mas posso definir mais alertas ou o tempo") —
// register() roda 1x quando o servidor Next.js sobe (dev ou produção,
// documentado em node_modules/next/dist/docs/.../instrumentation.md desta
// versão) e mantém um setInterval vivo enquanto o processo existir. Precisa
// do runtime Node (Prisma não roda no Edge) — só é carregado lá (instrumentation.ts).
const INTERVAL_MS = 60_000;

// Temperatura decai sozinha com o tempo (o score depende de "dias desde a
// última atividade") — sem um ciclo próprio, um registro que ninguém abre
// nunca esfriaria de verdade. 30 min é suficiente (não precisa ser fino tipo
// o de lembretes).
const TEMPERATURE_SWEEP_INTERVAL_MS = 30 * 60_000;

// Corpo do register() que só roda no Node.js — fica neste arquivo à parte
// porque o instrumentation.ts também é compilado para o runtime Edge, e as
// rotinas aqui usam Prisma e node:fs (Backup/Limpeza). Ver instrumentation.ts.
export async function registerNode() {

  // Turbopack pode reavaliar este módulo (hot reload do próprio arquivo em
  // dev) — sem esse guard, cada reavaliação criaria um novo setInterval e
  // duplicaria o envio dos lembretes.
  const globalWithGuard = globalThis as typeof globalThis & {
    __reminderSchedulerStarted?: boolean;
    __temperatureSweepStarted?: boolean;
    __maintenanceSchedulerStarted?: boolean;
    __sqliteWalChecked?: boolean;
    __licenseCheckStarted?: boolean;
  };

  if (!globalWithGuard.__reminderSchedulerStarted) {
    globalWithGuard.__reminderSchedulerStarted = true;

    const { checkAndSendDueReminders } = await import("@/lib/reminders/check-due-reminders");
    const { sendDailyAgendaSummaries } = await import("@/lib/reminders/daily-agenda-summary");

    async function tick() {
      try {
        await checkAndSendDueReminders();
      } catch (error) {
        console.error("[reminders] erro no ciclo do agendador de lembretes:", error);
      }
      // Resumo do dia (07:00 de Brasília, 1x por dia) — mesmo ciclo.
      try {
        await sendDailyAgendaSummaries();
      } catch (error) {
        console.error("[agenda] erro no resumo diário:", error);
      }
    }

    void tick();
    setInterval(tick, INTERVAL_MS);
  }

  // Banco em modo WAL (leitura e escrita ao mesmo tempo, sem "database is
  // locked" com vários atendentes) — persistente no arquivo. O CRM
  // instalado já liga pelo launcher; aqui cobre o desenvolvimento.
  if (!globalWithGuard.__sqliteWalChecked) {
    globalWithGuard.__sqliteWalChecked = true;
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
    } catch (error) {
      console.error("[db] não foi possível ligar o modo WAL:", error);
    }
  }

  // Backup e Limpeza programados (Configurações) — conferem a cada minuto
  // se já passou do horário do dia; cada um roda no máximo 1x por dia.
  if (!globalWithGuard.__maintenanceSchedulerStarted) {
    globalWithGuard.__maintenanceSchedulerStarted = true;

    const { runScheduledBackup } = await import("@/features/backup/service");
    const { runScheduledCleanup } = await import("@/features/cleanup/service");

    async function maintenanceTick() {
      try {
        await runScheduledBackup();
      } catch (error) {
        console.error("[backup] erro no backup programado:", error);
      }
      // Depois do backup: se a limpeza copia antes de apagar, o backup do
      // dia já está feito.
      try {
        await runScheduledCleanup();
      } catch (error) {
        console.error("[limpeza] erro na limpeza programada:", error);
      }
    }

    setTimeout(() => void maintenanceTick(), 30_000);
    setInterval(maintenanceTick, INTERVAL_MS);
  }

  // Licença e atualizações (arquivo de controle no GitHub): ao subir e
  // depois de hora em hora.
  if (!globalWithGuard.__licenseCheckStarted) {
    globalWithGuard.__licenseCheckStarted = true;
    const { checkLicenseNow } = await import("@/features/license/state");
    const licenseTick = () =>
      checkLicenseNow().catch((error) => console.error("[licença] erro na consulta:", error));
    setTimeout(licenseTick, 10_000);
    setInterval(licenseTick, 60 * 60_000);
  }

  if (!globalWithGuard.__temperatureSweepStarted) {
    globalWithGuard.__temperatureSweepStarted = true;

    const { recomputeStaleTemperatures } = await import("@/features/temperature/sweep");

    async function temperatureTick() {
      try {
        await recomputeStaleTemperatures();
      } catch (error) {
        console.error("[temperature] erro no ciclo de recálculo de temperatura:", error);
      }
    }

    void temperatureTick();
    setInterval(temperatureTick, TEMPERATURE_SWEEP_INTERVAL_MS);
  }
}

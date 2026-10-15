import { redirect } from "next/navigation";
import { BellRing, Clock, LogOut, ShieldAlert, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import { AfterHoursForm } from "@/features/atendimento-automation/after-hours-form";
import { AgendaRemindersForm } from "@/features/atendimento-automation/agenda-reminders-form";
import { ClosingMessageForm } from "@/features/atendimento-automation/closing-message-form";
import { WelcomeMessageForm } from "@/features/atendimento-automation/welcome-message-form";
import {
  getAgendaDailySummaryWhatsappEnabled,
  getAgendaWhatsappRemindersEnabled,
  getAtendimentoAutomationSettings,
} from "@/features/atendimento-automation/settings";
import { auth } from "@/lib/auth";

export default async function AtendimentoAutomationPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem configurar as mensagens automáticas."
      />
    );
  }

  const [settings, agendaRemindersEnabled, agendaDailySummaryWhatsapp] = await Promise.all([
    getAtendimentoAutomationSettings(),
    getAgendaWhatsappRemindersEnabled(),
    getAgendaDailySummaryWhatsappEnabled(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Atendimento"
        tabs={<SettingsTabs group="atendimento" />}
        description="Mensagens enviadas automaticamente pelo WhatsApp — no atendimento e nos lembretes da Agenda. Cada uma pode ser ligada/desligada separadamente."
      />

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Boas-vindas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WelcomeMessageForm enabled={settings.welcomeMessage.enabled} text={settings.welcomeMessage.text} />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="size-4" />
            Encerramento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClosingMessageForm enabled={settings.closingMessage.enabled} text={settings.closingMessage.text} />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4" />
            Fora do horário de atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AfterHoursForm
            enabled={settings.afterHours.enabled}
            time={settings.afterHours.time}
            text={settings.afterHours.text}
          />
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="size-4" />
            Lembretes da Agenda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AgendaRemindersForm enabled={agendaRemindersEnabled} dailySummaryWhatsapp={agendaDailySummaryWhatsapp} />
        </CardContent>
      </Card>
    </div>
  );
}

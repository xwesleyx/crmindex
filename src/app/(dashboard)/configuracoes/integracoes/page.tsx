import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Database,
  FileCheck2,
  MessageCircle,
  Search,
  ShieldAlert,
  Target,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { CfoApiKeyForm } from "@/features/integrations/cfo-api-key-form";
import { getCfoStatus } from "@/features/integrations/cfo-status";
import { getWhatsappCloudStatus, getWhatsappStatus } from "@/features/integrations/whatsapp-status";
import { WhatsappProviderSelector } from "@/features/integrations/whatsapp-provider-selector";
import { WhatsappCloudConfigForm } from "@/features/integrations/whatsapp-cloud-config-form";
import { WhatsappCloudGuide } from "@/features/integrations/whatsapp-cloud-guide";
import { getDefaultProviderName } from "@/features/atendimento/providers/registry";
import { auth } from "@/lib/auth";
import { WhatsappControlButtons } from "@/features/integrations/whatsapp-control-buttons";
import { WhatsappConnectionState } from "@/features/integrations/whatsapp-connection-state";
import { WhatsappServiceOffline } from "@/features/integrations/whatsapp-service-offline";
import { getLocalServiceInfo, readServiceLogTail } from "@/features/integrations/whatsapp-process";
import { RefreshButton } from "./refresh-button";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores acessam Integrações."
      />
    );
  }

  const provider = await getDefaultProviderName();
  const [status, cloudStatus, cfoStatus] = await Promise.all([
    provider === "neonize" ? getWhatsappStatus() : null,
    provider === "whatsapp_cloud" ? getWhatsappCloudStatus() : null,
    getCfoStatus(),
  ]);

  const localService = provider === "neonize" ? getLocalServiceInfo() : null;

  // URL pública desta instalação, pra montar a URL do webhook que vai no
  // painel da Meta (atrás do proxy do Render, vem nos x-forwarded-*).
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const webhookUrl = `${protocol}://${host}/api/webhooks/whatsapp-cloud`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Integrações" description="Conexões externas do CRM" />

      <Card size="sm" className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between xl:px-7 xl:py-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-success text-success-foreground">
                <MessageCircle className="size-8" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight">WhatsApp</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Conecte seu número e tenha um atendimento ainda mais eficiente com seus clientes.
                </p>
              </div>
            </div>

            {status?.configured && status.reachable && (
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <RefreshButton />
                <WhatsappControlButtons canManage={localService?.canManage ?? false} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 xl:px-7">
            <h3 className="text-sm font-semibold">Qual API usar?</h3>
            <WhatsappProviderSelector current={provider} />
            <p className="text-xs text-muted-foreground">
              A troca vale para as conversas novas. Uma conversa já aberta passa para o canal novo assim que o cliente
              mandar uma mensagem por ele.
            </p>
          </div>

          {provider === "manual" && (
            <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground xl:px-7">
              Nenhuma API conectada: as mensagens digitadas na Central ficam só registradas no CRM, nada sai pelo
              WhatsApp.
            </div>
          )}

          {status && !status.configured && (
            <div className="border-t border-border px-5 pb-5 xl:px-7">
              <EmptyState
                icon={MessageCircle}
                title="WhatsApp não configurado"
                description="Configure WHATSAPP_SERVICE_URL e WHATSAPP_SERVICE_SECRET no .env e suba o serviço em whatsapp-service/ (veja o README dessa pasta) para conectar um número real."
              />
            </div>
          )}

          {status?.configured && !status.reachable && (
            <div className="border-t border-border px-5 py-4 xl:px-7">
              <WhatsappServiceOffline
                reason={status.reason}
                detail={status.detail}
                canManage={localService?.canManage ?? false}
                manageBlockedReason={localService && !localService.canManage ? localService.reason : null}
                logTail={localService?.canManage ? readServiceLogTail() : null}
              />
            </div>
          )}

          {status?.configured && status.reachable && (
            <div className="border-t border-border px-5 py-4 xl:px-7">
              <WhatsappConnectionState
                connected={status.connected}
                loggedOut={status.loggedOut}
                number={status.number}
                qr={status.qr}
              />
            </div>
          )}

          {cloudStatus && (
            <div className="flex flex-col gap-5 border-t border-border px-5 py-5 xl:px-7">
              <div className="flex flex-wrap items-center gap-3">
                {!cloudStatus.configured && (
                  <StatusBadge label="Não configurado" tone="warning" />
                )}
                {cloudStatus.configured && !cloudStatus.ok && (
                  <>
                    <StatusBadge label="Erro na conexão" tone="destructive" />
                    <span className="text-sm text-muted-foreground">{cloudStatus.error}</span>
                  </>
                )}
                {cloudStatus.configured && cloudStatus.ok && (
                  <>
                    <StatusBadge label="Conectado" tone="success" solid />
                    <span className="text-sm text-muted-foreground">
                      {[cloudStatus.verifiedName, cloudStatus.displayPhoneNumber].filter(Boolean).join(" · ")}
                      {cloudStatus.qualityRating && ` · Qualidade: ${cloudStatus.qualityRating}`}
                    </span>
                  </>
                )}
                {cloudStatus.configured && <RefreshButton />}
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <WhatsappCloudConfigForm
                  webhookUrl={webhookUrl}
                  verifyToken={cloudStatus.verifyToken}
                  phoneNumberId={cloudStatus.phoneNumberId}
                  hasAccessToken={cloudStatus.configured || cloudStatus.hasAccessToken}
                  hasAppSecret={cloudStatus.configured || cloudStatus.hasAppSecret}
                />
                <WhatsappCloudGuide />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card size="sm" className="overflow-hidden">
          <CardHeader className="border-b border-border bg-accent/35 px-5 py-4 xl:px-7">
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Building2 className="size-5" />
              </span>
              <span>
                <span className="block">Prospecção CNPJ (CFO.com.br)</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Encontre novas empresas e oportunidades de negócio.
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-5 xl:p-7">
            {cfoStatus.configured ? (
              <StatusBadge label="Configurado" tone="success" solid className="w-fit" />
            ) : (
              <EmptyState
                icon={Building2}
                title="Prospecção CNPJ não configurada"
                description="Configure a API key abaixo pra habilitar a busca em CRM > Prospecção CNPJ."
              />
            )}
            <CfoApiKeyForm configured={cfoStatus.configured} />
          </CardContent>
        </Card>

        <Card size="sm" className="overflow-hidden">
          <CardHeader className="border-b border-border bg-accent/35 px-5 py-4 xl:px-7">
            <CardTitle className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Target className="size-5" />
              </span>
              <span>Mais oportunidades para o seu negócio</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 xl:p-7">
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              A integração com o CFO.com.br permite encontrar novas empresas e expandir sua base de
              clientes com mais facilidade e agilidade.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Search className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Consulta de empresas</span>
                  <span className="block text-xs text-muted-foreground">Dados completos e atualizados</span>
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Database className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Dados cadastrais</span>
                  <span className="block text-xs text-muted-foreground">CNPJ, endereço, telefone e muito mais</span>
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <FileCheck2 className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Situação fiscal</span>
                  <span className="block text-xs text-muted-foreground">Evite problemas e aumente a segurança</span>
                </span>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" />
              Integração pronta para apoiar sua prospecção.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

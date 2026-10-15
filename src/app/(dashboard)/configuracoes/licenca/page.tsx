import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CloudDownload, KeyRound, LockKeyhole, ShieldQuestion } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { CURRENT_VERSION } from "@/lib/changelog";
import { formatDateTime } from "@/lib/format";
import { isSuperAdmin } from "@/lib/super-admin";
import { CheckLicenseButton, LicenseCnpjForm } from "@/features/license/license-form";
import { canUpdateHere, getLicenseState, isNewerVersion, readUpdaterStatus } from "@/features/license/state";

const REASON_TEXT = {
  ok: "Licença ativa — o CNPJ está na lista de ativos.",
  nao_configurado: "Controle remoto não configurado neste build (ambiente de desenvolvimento) — nada trava.",
  sem_cnpj: "Nenhum CNPJ vinculado — o CRM fica travado até definir um.",
  aguardando: "Ainda não conseguiu consultar o GitHub — liberado até a primeira consulta.",
  cnpj_inativo: "CNPJ fora da lista de ativos — o CRM está travado para os demais usuários.",
} as const;

const UPDATER_STATE_TEXT = {
  agendado: "Atualização obrigatória agendada",
  baixando: "Baixando",
  instalando: "Instalando",
  ok: "Última atualização concluída",
  erro: "Erro na última atualização",
} as const;

// Só para o usuário do suporte (admin@crm.index) — para os outros a página
// nem existe.
export default async function LicencaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session.user.email)) notFound();

  const [state, updater] = await Promise.all([getLicenseState(), readUpdaterStatus()]);
  const Icon = state.locked ? LockKeyhole : state.reason === "ok" ? CheckCircle2 : ShieldQuestion;
  const tone = state.locked ? "text-destructive" : state.reason === "ok" ? "text-success" : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Licença"
        description="Vínculo desta instalação com o cliente (CNPJ) e atualizações. Visível só para o usuário do suporte."
        action={state.configured ? <CheckLicenseButton /> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Licença
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5">
              <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} />
              <div className="text-sm">
                <p className="font-medium">{state.locked ? "Travado" : "Liberado"}</p>
                <p className="text-muted-foreground">{REASON_TEXT[state.reason]}</p>
              </div>
            </div>
            <LicenseCnpjForm cnpj={state.cnpj} />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Última consulta</dt>
                <dd>{state.lastCheckAt ? formatDateTime(state.lastCheckAt) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Última consulta com sucesso</dt>
                <dd>{state.lastOkAt ? formatDateTime(state.lastOkAt) : "—"}</dd>
              </div>
              {state.lastError && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Erro na última consulta</dt>
                  <dd className="text-destructive">{state.lastError}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-muted-foreground">
              O CRM consulta o GitHub ao ligar e depois de hora em hora. Sem internet, vale a última resposta — nunca
              trava por falta de conexão.
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudDownload className="size-4" />
              Atualizações
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Versão instalada</dt>
                <dd className="font-medium">{CURRENT_VERSION}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Versão publicada</dt>
                <dd className="font-medium">
                  {state.latest ? state.latest.numero : "—"}
                  {state.latest?.forcar && <span className="ml-1.5 text-xs text-destructive">(obrigatória)</span>}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Atualizador</dt>
                <dd>
                  {updater
                    ? [
                        UPDATER_STATE_TEXT[updater.estado] ?? updater.estado,
                        updater.versao,
                        updater.mensagem,
                        updater.em ? formatDateTime(updater.em) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : canUpdateHere()
                      ? "Nenhuma atualização feita ainda."
                      : "Só funciona no CRM instalado."}
                </dd>
              </div>
            </dl>
            {isNewerVersion(state.latest) && (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs">
                Versão nova disponível — os administradores veem o aviso &quot;Atualizar agora&quot; no topo das
                telas.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

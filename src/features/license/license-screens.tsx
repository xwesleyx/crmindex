import Link from "next/link";
import { LockKeyhole, LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCNPJ } from "@/lib/format";
import { signOutAction } from "@/features/auth/actions";
import type { LicenseState } from "@/features/license/state";

// Tela no lugar do CRM quando a licença está travada (todo mundo, menos o
// usuário do suporte). O WhatsApp continua recebendo mensagens por trás.
export function LicenseLockedScreen({ state }: { state: LicenseState }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center shadow-sm ring-1 ring-foreground/10">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <LockKeyhole className="size-7" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-xl font-semibold">Sistema suspenso</h1>
          <p className="text-sm text-muted-foreground">
            {state.reason === "sem_cnpj"
              ? "Esta instalação ainda não foi vinculada a um CNPJ."
              : "O acesso ao CRM está temporariamente suspenso."}{" "}
            Entre em contato com o suporte para regularizar.
          </p>
          {state.contato && <p className="mt-1 text-sm font-medium">{state.contato}</p>}
          {state.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {formatCNPJ(state.cnpj)}</p>}
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="size-4" />
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}

// Faixa pro usuário do suporte: ele entra mesmo travado, mas fica avisado.
export function LicenseSupportBanner({ state }: { state: LicenseState }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm">
      <ShieldAlert className="size-4 shrink-0 text-destructive" />
      <span className="min-w-0 flex-1">
        <strong>CRM travado para os demais usuários</strong> —{" "}
        {state.reason === "sem_cnpj"
          ? "nenhum CNPJ vinculado a esta instalação."
          : `o CNPJ ${formatCNPJ(state.cnpj)} não está na lista de ativos.`}
      </span>
      <Link href="/configuracoes/licenca" className="font-medium text-destructive hover:underline">
        Abrir Licença
      </Link>
    </div>
  );
}

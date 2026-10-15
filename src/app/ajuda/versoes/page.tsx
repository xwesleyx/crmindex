import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, LifeBuoy } from "lucide-react";

import { auth } from "@/lib/auth";
import { CHANGELOG, CURRENT_VERSION, LAST_UPDATED } from "@/lib/changelog";
import { formatChangelogDate, versionAnchor } from "@/lib/changelog-format";
import { PrintButton } from "@/features/help/print-button";
import { VersionsNav } from "@/features/help/versions-nav";

// Histórico de versões em página própria (antes era um pop-up dentro da
// Central de Ajuda): mesmo layout da Ajuda — versões como menu à esquerda,
// o que mudou em cada uma à direita.
export default async function VersoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-full bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-lg font-semibold text-foreground">Histórico de versões</h1>
            <p className="text-xs text-muted-foreground">
              CRM Integra · versão {CURRENT_VERSION} · atualizado em {formatChangelogDate(LAST_UPDATED)} ·{" "}
              {CHANGELOG.length} versões
            </p>
          </div>
          <PrintButton />
          <Link
            href="/ajuda"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted"
          >
            <LifeBuoy className="size-4" />
            Central de Ajuda
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Voltar ao sistema
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block print:hidden">
          <div className="sticky top-20">
            <VersionsNav entries={CHANGELOG} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <details className="mb-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10 lg:hidden print:hidden">
            <summary className="cursor-pointer text-sm font-medium text-foreground">Versões</summary>
            <div className="mt-3">
              <VersionsNav entries={CHANGELOG} />
            </div>
          </details>

          <section className="mb-8">
            <h2 className="font-heading text-2xl font-semibold text-foreground">O que mudou no sistema</h2>
            <p className="mt-2 max-w-3xl text-sm text-foreground/80">
              Cada versão lista as mudanças entregues, da mais recente para a mais antiga. Use o menu ao lado para
              pular direto para uma versão, ou a busca para achar quando algo mudou.
            </p>
          </section>

          <ol className="flex flex-col gap-5">
            {CHANGELOG.map((entry, index) => (
              <li
                key={entry.version}
                id={versionAnchor(entry.version)}
                className="scroll-mt-20 break-inside-avoid rounded-xl bg-card p-5 ring-1 ring-foreground/10"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
                  <span className="inline-flex h-7 items-center rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary">
                    v{entry.version}
                  </span>
                  {index === 0 && (
                    <span className="inline-flex h-6 items-center rounded-full bg-success/15 px-2.5 text-xs font-medium text-success">
                      Versão atual
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatChangelogDate(entry.date)}</span>
                  <h3 className="w-full font-heading text-lg font-semibold text-foreground">{entry.title}</h3>
                </div>
                <ul className="flex flex-col gap-2">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </main>
      </div>
    </div>
  );
}

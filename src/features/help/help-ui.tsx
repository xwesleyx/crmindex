import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "cn";

import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import { History } from "lucide-react";
import type { GroupDoc, ScreenDoc } from "@/features/help/content";

function TocSubLinks({ items }: { items: { id: string; title: string; soon?: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-0.5 border-l border-border pl-2.5">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="truncate">{item.title}</span>
            {item.soon && <span className="shrink-0 text-[10px] text-muted-foreground/70">em breve</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

// Sanfona: só um grupo fica aberto por vez (comportamento padrão do
// Accordion, igual Configurações > Kanbans) — clicar em um grupo fecha
// o que estava aberto antes, sem precisar fechar manualmente.
export function TocNav({
  groups,
  conceptIds,
}: {
  groups: GroupDoc[];
  conceptIds: { id: string; title: string }[];
}) {
  return (
    <nav className="text-sm">
      <Accordion defaultValue={[]} className="flex flex-col gap-0.5">
        <AccordionItem value="conceitos" className="border-b-0">
          <AccordionTrigger className="rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:bg-muted hover:text-foreground [&>svg]:size-3.5">
            Conceitos gerais
          </AccordionTrigger>
          <AccordionPanel className="!py-0.5">
            <TocSubLinks items={conceptIds} />
          </AccordionPanel>
        </AccordionItem>

        {groups.map((group) =>
          group.screens.length > 1 ? (
            <AccordionItem key={group.id} value={group.id} className="border-b-0">
              <AccordionTrigger className="rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted [&>svg]:size-3.5">
                <span className="flex min-w-0 items-center gap-2">
                  <group.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{group.title}</span>
                </span>
              </AccordionTrigger>
              <AccordionPanel className="!py-0.5">
                <TocSubLinks
                  items={group.screens.map((s) => ({ id: s.id, title: s.title, soon: s.status === "soon" }))}
                />
              </AccordionPanel>
            </AccordionItem>
          ) : (
            <a
              key={group.id}
              href={`#${group.screens[0]?.id ?? group.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <group.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{group.title}</span>
            </a>
          )
        )}
      </Accordion>

      <Link
        href="/ajuda/versoes"
        className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted"
      >
        <History className="size-4 shrink-0 text-muted-foreground" />
        Histórico de versões
      </Link>
    </nav>
  );
}

export function GroupSection({ group }: { group: GroupDoc }) {
  const Icon = group.icon;
  return (
    <section id={group.id} className="scroll-mt-20">
      <div className="mb-5 flex items-start gap-3 border-b border-border pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-2xl font-semibold text-foreground">{group.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Acesso: {group.roles}</p>
          {group.intro && <p className="mt-1.5 max-w-3xl text-sm text-foreground/80">{group.intro}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {group.screens.map((screen) => (
          <ScreenCard key={screen.id} screen={screen} />
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: ScreenDoc["status"] }) {
  if (status === "soon") {
    return (
      <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
        Em breve
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      Disponível
    </span>
  );
}

function FieldGroup({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground/90">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScreenCard({ screen }: { screen: ScreenDoc }) {
  return (
    <article
      id={screen.id}
      className={cn(
        "scroll-mt-20 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10 sm:p-5",
        screen.status === "soon" && "opacity-80"
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-heading text-base font-semibold text-foreground">{screen.title}</h3>
        <StatusBadge status={screen.status} />
        {screen.path && (
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {screen.path}
          </code>
        )}
      </div>

      {screen.roles && <p className="mb-2 text-xs text-muted-foreground">Quem acessa: {screen.roles}</p>}

      <p className="mb-3 text-sm text-foreground/90">{screen.purpose}</p>

      {(screen.fields || screen.filters || screen.actions) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup title="Campos" items={screen.fields} />
          <FieldGroup title="Filtros de busca" items={screen.filters} />
          <FieldGroup title="Ações disponíveis" items={screen.actions} />
        </div>
      )}

      {screen.notes && screen.notes.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          {screen.notes.map((note, i) => (
            <div key={i} className="flex gap-2 text-xs text-foreground/85">
              <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function ConceptCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article id={id} className="scroll-mt-20 rounded-xl bg-card p-4 text-sm text-card-foreground ring-1 ring-foreground/10 sm:p-5">
      <h3 className="mb-2 font-heading text-base font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col gap-2 text-sm text-foreground/90">{children}</div>
    </article>
  );
}

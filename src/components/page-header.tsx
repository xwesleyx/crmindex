import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

// Cabeçalho padrão de toda página de lista/detalhe — título, subtítulo,
// ação principal e (nas páginas de detalhe) o link de voltar. Antes cada
// página remontava essa estrutura na mão com pequenas divergências de
// espaçamento; agora é um único lugar (seção 9 do escopo de refinamento).
export function PageHeader({
  title,
  description,
  action,
  tabs,
  backHref,
  backLabel,
}: {
  title: ReactNode;
  // Abas ao lado do título (ex.: Configurações > Usuários | Permissões).
  tabs?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {backHref && (
        <Link
          href={backHref}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-balance">
              {title}
            </h1>
            {tabs}
          </div>
          {description && (
            <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>
          )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

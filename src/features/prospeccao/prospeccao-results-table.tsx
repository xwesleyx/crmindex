"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatCNPJ, formatDate } from "@/lib/format";
import { formatMoneyCents } from "@/lib/money";
import { fetchCompanyByCnpj } from "@/lib/cnpj-lookup";
import { isMaskedValue } from "@/lib/cnpj-prospection-api";
import { importProspectsAsLeads } from "@/features/prospeccao/actions";
import type { ProspectResult } from "@/features/prospeccao/types";

function DetailField({
  label,
  value,
  masked,
}: {
  label: string;
  value: string;
  masked?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">
        {value || "—"}
        {masked && (
          <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            (mascarado no plano gratuito da CFO)
          </span>
        )}
      </p>
    </div>
  );
}

// null/undefined vira "—" (nunca consultado); true/false viram Sim/Não —
// diferente de simplesmente omitir o campo, porque "Não optante" é uma
// resposta de verdade, não a ausência de uma.
function formatYesNo(value: boolean | undefined): string {
  if (value === undefined) return "—";
  return value ? "Sim" : "Não";
}

function ProspectDetailDialog({
  result,
  onOpenChange,
  onEnriched,
}: {
  result: ProspectResult | null;
  onOpenChange: (open: boolean) => void;
  onEnriched: (cnpj: string, patch: Partial<ProspectResult>) => void;
}) {
  const [enriching, setEnriching] = useState(false);

  async function handleEnrich() {
    if (!result) return;
    setEnriching(true);
    try {
      const outcome = await fetchCompanyByCnpj(result.cnpj);
      if (!outcome.ok) {
        const messages: Record<typeof outcome.reason, string> = {
          invalid: "CNPJ inválido.",
          not_found: "Não encontrado na Receita Federal.",
          rate_limited: "Muitas consultas seguidas — aguarde alguns segundos e tente de novo.",
          error: "Não foi possível consultar a Receita Federal agora.",
        };
        toast.error(messages[outcome.reason]);
        return;
      }
      const d = outcome.data;
      // Telefone/e-mail da CFO vêm mascarados no plano gratuito ("(28)
      // 9***-**72") — um valor mascarado não é "melhor que nada" pra decidir
      // se liga pro cliente, então só mantém o da CFO se ele vier de verdade;
      // senão tenta o da BrasilAPI (que às vezes tem, às vezes não).
      const cfoTelefoneUsavel = result.telefone && !isMaskedValue(result.telefone) ? result.telefone : undefined;
      const cfoEmailUsavel = result.email && !isMaskedValue(result.email) ? result.email : undefined;
      onEnriched(result.cnpj, {
        enrichedAt: new Date().toISOString(),
        nomeFantasia: result.nomeFantasia || d.nomeFantasia,
        telefone: cfoTelefoneUsavel ?? d.telefone,
        telefone2: d.telefone2,
        email: cfoEmailUsavel ?? d.email,
        situacao: result.situacao || d.situacao,
        situacaoData: d.situacaoData,
        cnae: result.cnae || d.cnae,
        cnaeDescricao: result.cnaeDescricao || d.cnaeDescricao,
        cnaesSecundarios: d.cnaesSecundarios,
        naturezaJuridica: d.naturezaJuridica,
        porte: result.porte || d.porte,
        capitalSocial: result.capitalSocial ?? d.capitalSocial,
        dataAbertura: result.dataAbertura || d.dataAbertura,
        // BrasilAPI só entra onde a CFO não tinha — sobrescrever com um
        // campo vazio da BrasilAPI (comum em MEI) jogaria fora dado bom.
        logradouro: result.logradouro || d.logradouro,
        numero: result.numero || d.numero,
        complemento: result.complemento || d.complemento,
        bairro: result.bairro || d.bairro,
        cep: result.cep || d.cep,
        optanteSimples: d.optanteSimples,
        optanteMei: d.optanteMei,
      });
      toast.success("Dados completos da Receita carregados.");
    } finally {
      setEnriching(false);
    }
  }

  return (
    <Dialog open={!!result} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result?.razaoSocial}</DialogTitle>
        </DialogHeader>
        {result && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Dados gerais</p>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <DetailField label="Nome fantasia" value={result.nomeFantasia ?? ""} />
                <DetailField label="CNPJ" value={formatCNPJ(result.cnpj)} />
                <DetailField
                  label="Data de abertura"
                  value={result.dataAbertura ? formatDate(new Date(result.dataAbertura)) : ""}
                />
                <DetailField label="Situação cadastral" value={result.situacao ?? ""} />
                <DetailField
                  label="Data da situação"
                  value={result.situacaoData ? formatDate(new Date(result.situacaoData)) : ""}
                />
                <DetailField label="Natureza jurídica" value={result.naturezaJuridica ?? ""} />
                <DetailField label="Porte" value={result.porte ?? ""} />
                <DetailField
                  label="Capital social"
                  value={
                    typeof result.capitalSocial === "number"
                      ? formatMoneyCents(Math.round(result.capitalSocial * 100))
                      : ""
                  }
                />
                <DetailField
                  label="CNAE principal"
                  value={[result.cnae, result.cnaeDescricao].filter(Boolean).join(" — ")}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contato</p>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <DetailField
                  label="Telefone"
                  value={result.telefone ?? ""}
                  masked={isMaskedValue(result.telefone)}
                />
                <DetailField label="Telefone 2" value={result.telefone2 ?? ""} />
                <DetailField
                  label="E-mail"
                  value={result.email ?? ""}
                  masked={isMaskedValue(result.email)}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Endereço</p>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <DetailField label="Logradouro" value={result.logradouro || result.endereco || ""} />
                <DetailField label="Número" value={result.numero ?? ""} />
                <DetailField label="Complemento" value={result.complemento ?? ""} />
                <DetailField label="Bairro" value={result.bairro ?? ""} />
                <DetailField label="Cidade/UF" value={[result.cidade, result.uf].filter(Boolean).join("/")} />
                <DetailField label="CEP" value={result.cep ?? ""} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Regime tributário
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <DetailField label="Optante pelo Simples Nacional" value={formatYesNo(result.optanteSimples)} />
                <DetailField label="Optante pelo MEI" value={formatYesNo(result.optanteMei)} />
              </div>
            </div>

            {result.enrichedAt && (
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  CNAEs secundários
                </p>
                {result.cnaesSecundarios && result.cnaesSecundarios.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {result.cnaesSecundarios.map((c) => (
                      <li key={c.codigo} className="text-sm">
                        <span className="text-muted-foreground">{c.codigo}</span> — {c.descricao}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum CNAE secundário.</p>
                )}
              </div>
            )}

            {result.enrichedAt && (
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Sócios e administradores
                </p>
                {result.socios && result.socios.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {result.socios.map((s, i) => (
                      <li key={i} className="text-sm">
                        {s.nome}
                        {s.qualificacao && <span className="text-muted-foreground"> — {s.qualificacao}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Esta empresa não possui sócios.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {result.enrichedAt
                  ? `Dados completos da Receita carregados em ${formatDate(new Date(result.enrichedAt))}.`
                  : "Esses dados vêm da busca por cidade — CNAE, sócios, regime tributário e endereço completo pedem uma consulta à parte."}
              </p>
              <Button variant="outline" size="sm" onClick={handleEnrich} disabled={enriching}>
                {enriching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {enriching ? "Buscando..." : result.enrichedAt ? "Atualizar dados" : "Buscar dados completos"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProspeccaoResultsTable({
  results,
  onRemove,
  onEnriched,
  onClear,
}: {
  results: ProspectResult[];
  onRemove: (cnpjs: string[]) => void;
  onEnriched: (cnpj: string, patch: Partial<ProspectResult>) => void;
  onClear: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailCnpj, setDetailCnpj] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (results.length === 0) return null;

  const detailResult = results.find((r) => r.cnpj === detailCnpj) ?? null;

  function toggle(cnpj: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cnpj)) next.delete(cnpj);
      else next.add(cnpj);
      return next;
    });
  }

  function handleImport() {
    const items = results.filter((r) => selected.has(r.cnpj));
    if (items.length === 0) return;

    startTransition(async () => {
      const result = await importProspectsAsLeads(items);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { created, skipped } = result.data;
      toast.success(
        skipped > 0
          ? `${created} lead(s) criado(s). ${skipped} ignorado(s) (já existiam).`
          : `${created} lead(s) criado(s).`
      );
      onRemove(items.map((i) => i.cnpj));
      setSelected(new Set());
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "resultado" : "resultados"}
        </p>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" />
          Limpar resultados
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Razão social</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const existing = r.existingCompanyId
                ? { label: "Já é cliente", href: `/clientes/empresas/${r.existingCompanyId}` }
                : r.existingLeadId
                  ? { label: "Já é lead", href: `/crm/leads/${r.existingLeadId}` }
                  : null;

              return (
                <TableRow
                  key={r.cnpj}
                  className="cursor-pointer"
                  onClick={() => setDetailCnpj(r.cnpj)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(r.cnpj)}
                      onCheckedChange={() => toggle(r.cnpj)}
                      disabled={!!existing}
                    />
                  </TableCell>
                  <TableCell className="max-w-64 truncate font-medium">
                    {r.razaoSocial}
                    {r.nomeFantasia && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        ({r.nomeFantasia})
                      </span>
                    )}
                    {r.enrichedAt && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">(dados completos)</span>
                    )}
                  </TableCell>
                  <TableCell>{formatCNPJ(r.cnpj)}</TableCell>
                  <TableCell>{r.dataAbertura ? formatDate(new Date(r.dataAbertura)) : "—"}</TableCell>
                  <TableCell>
                    {[r.cidade, r.uf].filter(Boolean).join("/") || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.telefone || r.email ? (
                      <div className="flex flex-col">
                        {r.telefone && <span>{r.telefone}</span>}
                        {r.email && <span>{r.email}</span>}
                      </div>
                    ) : (
                      "sem contato"
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => existing && e.stopPropagation()}>
                    {existing ? (
                      <Link href={existing.href} className="hover:underline">
                        <StatusBadge label={existing.label} tone="info" />
                      </Link>
                    ) : (
                      <StatusBadge label={r.situacao || "Nova"} tone="success" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </Button>
            <Button size="sm" onClick={handleImport} disabled={isPending}>
              {isPending ? "Criando..." : "Transformar em Lead"}
            </Button>
          </div>
        </div>
      )}

      <ProspectDetailDialog
        result={detailResult}
        onOpenChange={(open) => !open && setDetailCnpj(null)}
        onEnriched={onEnriched}
      />
    </div>
  );
}

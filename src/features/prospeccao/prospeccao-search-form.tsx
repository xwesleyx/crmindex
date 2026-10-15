"use client";

import { useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BR_STATES } from "@/lib/br-states";
import { useBrMunicipios } from "@/hooks/use-br-municipios";
import { searchCnpjProspects } from "@/features/prospeccao/actions";
import { PROSPECCAO_DIAS_OPTIONS } from "@/features/prospeccao/schema";
import type { ProspeccaoFilters } from "@/features/prospeccao/storage";
import type { ProspectResult } from "@/features/prospeccao/types";

export function ProspeccaoSearchForm({
  filters,
  onFiltersChange,
  onResults,
}: {
  filters: ProspeccaoFilters;
  onFiltersChange: (filters: ProspeccaoFilters) => void;
  onResults: (results: ProspectResult[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { uf, cidade, dias, cnae, revelarContatos } = filters;

  const { cities, loading: loadingCities } = useBrMunicipios(uf);

  function handleSearch() {
    if (!uf || !cidade) {
      toast.error("Escolha estado e cidade antes de buscar.");
      return;
    }

    startTransition(async () => {
      const result = await searchCnpjProspects({ uf, cidade, dias, cnae: cnae || undefined, revelarContatos });
      if (!result.success) {
        toast.error(result.error);
        onResults([]);
        return;
      }
      if (result.data.length === 0) {
        toast.info("Nenhuma empresa nova encontrada nesse período/cidade.");
      }
      onResults(result.data);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Estado</Label>
          <Select
            value={uf}
            onValueChange={(v) => onFiltersChange({ ...filters, uf: v ?? undefined, cidade: undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {BR_STATES.map((s) => (
                <SelectItem key={s.uf} value={s.uf}>
                  {s.name} ({s.uf})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Cidade</Label>
          <Select
            value={cidade}
            onValueChange={(v) => onFiltersChange({ ...filters, cidade: v ?? undefined })}
            disabled={!uf}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={uf ? (loadingCities ? "Carregando..." : "Selecione") : "Escolha a UF primeiro"} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((cityName) => (
                <SelectItem key={cityName} value={cityName}>
                  {cityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Período</Label>
          <Select value={String(dias)} onValueChange={(v) => onFiltersChange({ ...filters, dias: Number(v) })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROSPECCAO_DIAS_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Últimos {n} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cnae">CNAE (opcional)</Label>
          <Input
            id="cnae"
            placeholder="Ex: 6201"
            value={cnae}
            onChange={(e) => onFiltersChange({ ...filters, cnae: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={revelarContatos}
          onCheckedChange={(checked) => onFiltersChange({ ...filters, revelarContatos: !!checked })}
        />
        <span>
          Revelar telefone e e-mail de verdade (sem essa opção, vem mascarado — ex: “(28) 9***-**72”)
          <span className="block text-xs text-muted-foreground">
            Cada empresa revelada consome 1 “lead” da sua cota mensal da CFO — empresas já reveladas nos últimos 30
            dias não consomem de novo. Deixe desmarcado pra só navegar sem gastar cota.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Plano gratuito da CFO.com.br: até 25 resultados por busca, 100 buscas por mês.
        </p>
        <Button onClick={handleSearch} disabled={isPending} size="sm">
          <Search className="size-4" />
          {isPending ? "Buscando..." : "Buscar empresas novas"}
        </Button>
      </div>
    </div>
  );
}

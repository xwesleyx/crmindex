"use client";

import { useEffect, useState } from "react";

// Município não dá pra hardcodar (~5570 no Brasil) — busca na API pública do
// IBGE (CORS liberado, confirmado via curl neste projeto) só quando a UF
// muda, e cacheia por UF num Map de módulo (sobrevive entre aberturas do
// formulário na mesma sessão de página, evita rebuscar toda hora).
const cache = new Map<string, string[]>();

type IbgeMunicipio = { nome: string };

export function useBrMunicipios(uf: string | undefined) {
  // "version" só existe pra forçar um re-render quando o fetch (efeito
  // abaixo) termina e popula o cache — cities/loading são sempre derivados
  // direto do cache no render (nunca duplicados num state próprio que
  // precisaria ser "resetado" em setState síncrono dentro do efeito).
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!uf || cache.has(uf)) return;

    let cancelled = false;
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then((res) => (res.ok ? (res.json() as Promise<IbgeMunicipio[]>) : Promise.reject(res)))
      .then((data) => {
        const names = data.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
        cache.set(uf, names);
      })
      .catch(() => {
        cache.set(uf, []);
      })
      .finally(() => {
        if (!cancelled) setVersion((v) => v + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [uf]);

  return { cities: uf ? (cache.get(uf) ?? []) : [], loading: !!uf && !cache.has(uf) };
}

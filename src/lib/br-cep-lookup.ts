import { onlyDigits } from "@/lib/validators";

export type CepAddress = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

// ViaCEP (CORS liberado, confirmado via curl neste projeto) — chamado direto
// do client quando o campo de CEP completa 8 dígitos, pra auto-preencher
// UF/cidade/bairro/logradouro (pedido do usuário: "ao digitar o CEP já puxa
// a UF e cidade").
export async function fetchAddressByCep(cep: string): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro || !data.uf || !data.localidade) return null;
    return {
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      localidade: data.localidade,
      uf: data.uf,
    };
  } catch {
    return null;
  }
}

// Dinheiro sempre em centavos (Int) — nunca float (seção 5 do escopo da
// Etapa 4). Único lugar que formata/parseia moeda no sistema; nenhum
// componente deve fazer isso na mão.

export function formatMoneyCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Versão compacta para eixos de gráfico ("R$ 12,5 mil" em vez de
// "R$ 12.500,00") — mesma fonte (centavos → BRL), só um formato mais curto
// pra caber em labels de eixo.
export function formatMoneyCompact(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

// Extrai só os dígitos de uma string digitada e interpreta como centavos —
// mesma UX de máscara de dinheiro usada por bancos brasileiros: digitar
// "125050" mostra "R$ 1.250,50". Evita a ambiguidade de "," vs "." como
// separador decimal em texto livre.
export function digitsToCents(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

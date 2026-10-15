// Datas do changelog são "AAAA-MM-DD" (sem hora). new Date("2026-10-14") lê
// como meia-noite UTC — no Brasil isso ainda é dia 13, e a data aparecia um
// dia antes. Monta a data no fuso local.
export function formatChangelogDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

// Âncora de cada versão na página de Histórico ("1.57" -> "v1-57").
export function versionAnchor(version: string): string {
  return `v${version.replace(/\./g, "-")}`;
}

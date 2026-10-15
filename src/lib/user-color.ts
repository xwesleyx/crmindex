// Uma cor por pessoa — sempre a mesma pro mesmo usuário, em qualquer tela
// (Quadro do Atendimento, Agenda). Usada como faixa lateral/fundo leve do
// card e no nome em negrito.
const USER_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
  "#65a30d",
  "#c2410c",
];

export const NO_USER_COLOR = "#94a3b8";

export function userColor(userId: string | null | undefined): string {
  if (!userId) return NO_USER_COLOR;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return USER_COLORS[hash % USER_COLORS.length];
}

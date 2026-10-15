export const SIGNAL_TYPES = [
  "pedeProposta",
  "perguntouPreco",
  "pedeDemo",
  "informouPrazo",
  "problemaUrgente",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_FIELD: Record<SignalType, string> = {
  pedeProposta: "signalPedeProposta",
  perguntouPreco: "signalPerguntouPreco",
  pedeDemo: "signalPedeDemo",
  informouPrazo: "signalInformouPrazo",
  problemaUrgente: "signalProblemaUrgente",
};

export const SIGNAL_LABELS: Record<SignalType, string> = {
  pedeProposta: "Pediu proposta",
  perguntouPreco: "Perguntou preço",
  pedeDemo: "Pediu demonstração",
  informouPrazo: "Informou prazo",
  problemaUrgente: "Problema urgente",
};

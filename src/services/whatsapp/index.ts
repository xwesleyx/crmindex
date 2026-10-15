import type { WhatsAppProvider } from "./types";

export type { WhatsAppProvider, WhatsAppMessage, WhatsAppConversation } from "./types";

// Nenhum provedor real está conectado ainda (Fase 7). Chamar isto antes da
// integração é um erro de programação, não algo para simular silenciosamente
// — por isso falha alto a falar, em vez de fingir que enviou uma mensagem.
export function getWhatsAppProvider(): WhatsAppProvider {
  throw new Error(
    "Nenhum provedor de WhatsApp configurado ainda (previsto para a Fase 7). " +
      "Implemente WhatsAppProvider em src/services/whatsapp/providers/<nome>.ts e registre aqui."
  );
}

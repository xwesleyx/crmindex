"use client";

import { createContext, useContext, type ReactNode } from "react";

// Se os lembretes da Agenda por WhatsApp estão ligados (Configurações >
// Mensagens automáticas). Lido uma vez no layout autenticado e repassado
// por aqui, pra qualquer formulário (tarefa, usuário, perfil) esconder o
// que só faz sentido com o envio ligado — sem passar prop por cada tela.
const AgendaRemindersContext = createContext(true);

export function AgendaRemindersProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <AgendaRemindersContext.Provider value={enabled}>{children}</AgendaRemindersContext.Provider>;
}

export function useAgendaWhatsappRemindersEnabled(): boolean {
  return useContext(AgendaRemindersContext);
}

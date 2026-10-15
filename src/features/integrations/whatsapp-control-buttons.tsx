"use client";

import { LogOut, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  logoutWhatsappService,
  reconnectWhatsappService,
  restartWhatsappService,
  stopWhatsappService,
} from "@/features/integrations/actions";

type ActionResult = { success: boolean; error?: string };

// Textos dos pop-ups por ação: o que está acontecendo (enquanto roda) e o
// que muda na tela depois (sucesso/erro) — nada de "comando enviado" genérico.
type ActionCopy = {
  run: () => Promise<ActionResult>;
  loading: string;
  success: string;
  successDescription: string;
  errorTitle: string;
};

const ACTIONS = {
  logout: {
    run: logoutWhatsappService,
    loading: "Desconectando o número do WhatsApp...",
    success: "WhatsApp desconectado",
    successDescription:
      "O número saiu deste CRM e as mensagens pararam de chegar. Para conectar de novo, clique em Gerar QR novamente e escaneie com o celular.",
    errorTitle: "Não foi possível deslogar",
  },
  reconnect: {
    run: reconnectWhatsappService,
    loading: "Reconectando ao WhatsApp...",
    success: "Reconexão concluída",
    successDescription:
      "Se havia uma sessão salva, o número volta a ficar Conectado sozinho. Se não, um QR code novo aparece na tela para escanear.",
    errorTitle: "Não foi possível gerar o QR",
  },
  restart: {
    run: restartWhatsappService,
    loading: "Reiniciando o serviço do WhatsApp... (leva alguns segundos)",
    success: "Serviço reiniciado",
    successDescription:
      "O serviço foi encerrado e iniciado de novo, relendo as configurações. A sessão salva é restaurada sem precisar escanear o QR.",
    errorTitle: "Não foi possível reiniciar",
  },
  stop: {
    run: stopWhatsappService,
    loading: "Parando o serviço do WhatsApp...",
    success: "Serviço parado",
    successDescription:
      "Nenhuma mensagem entra ou sai pelo WhatsApp até o serviço voltar. Use Iniciar serviço nesta tela para ligar de novo — o número continua pareado.",
    errorTitle: "Não foi possível parar o serviço",
  },
} satisfies Record<string, ActionCopy>;

const TOAST_DURATION_MS = 8000;

export function WhatsappControlButtons({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function runAction(copy: ActionCopy) {
    const toastId = toast.loading(copy.loading);
    const result = await copy.run();

    if (!result.success) {
      toast.error(copy.errorTitle, {
        id: toastId,
        description: result.error ?? "O serviço do WhatsApp não executou a ação.",
        duration: TOAST_DURATION_MS,
      });
    } else {
      toast.success(copy.success, {
        id: toastId,
        description: copy.successDescription,
        duration: TOAST_DURATION_MS,
      });
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => runAction(ACTIONS.logout)}>
        <LogOut className="size-4" />
        Deslogar
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => runAction(ACTIONS.reconnect)}
      >
        <RefreshCw className="size-4" />
        Gerar QR novamente
      </Button>

      {canManage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => runAction(ACTIONS.restart)}
        >
          <RotateCcw className="size-4" />
          Reiniciar serviço
        </Button>
      )}

      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => runAction(ACTIONS.stop)}
      >
        <ShieldAlert className="size-4" />
        Parar serviço
      </Button>
    </div>
  );
}

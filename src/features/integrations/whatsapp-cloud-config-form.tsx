"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateWhatsappCloudVerifyToken,
  removeWhatsappCloudConfig,
  saveWhatsappCloudConfig,
} from "@/features/integrations/actions";
import { whatsappCloudConfigSchema, type WhatsappCloudConfigInput } from "@/features/integrations/schema";

type Props = {
  webhookUrl: string;
  verifyToken: string | null;
  phoneNumberId: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
};

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} readOnly className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copiar ${label}`}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function WhatsappCloudConfigForm({ webhookUrl, verifyToken, phoneNumberId, hasAccessToken, hasAppSecret }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"token" | "remove" | null>(null);
  const configured = !!phoneNumberId || hasAccessToken || hasAppSecret;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WhatsappCloudConfigInput>({
    resolver: zodResolver(whatsappCloudConfigSchema),
    defaultValues: { phoneNumberId: phoneNumberId ?? "", accessToken: "", appSecret: "" },
  });

  async function onSubmit(data: WhatsappCloudConfigInput) {
    const result = await saveWhatsappCloudConfig(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Configuração da API oficial salva.");
    reset({ phoneNumberId: data.phoneNumberId, accessToken: "", appSecret: "" });
    startTransition(() => router.refresh());
  }

  async function run(kind: "token" | "remove") {
    setBusy(kind);
    const result = kind === "token" ? await generateWhatsappCloudVerifyToken() : await removeWhatsappCloudConfig();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(kind === "token" ? "Verify token gerado." : "Configuração da API oficial removida.");
    if (kind === "remove") reset({ phoneNumberId: "", accessToken: "", appSecret: "" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">1. Webhook (cole no painel da Meta)</h3>
        <CopyField id="wa-cloud-webhook" label="URL de callback" value={webhookUrl} />
        {verifyToken ? (
          <CopyField id="wa-cloud-verify" label="Verify token" value={verifyToken} />
        ) : (
          <p className="text-xs text-muted-foreground">Gere o verify token antes de configurar o webhook na Meta.</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={busy !== null || isPending}
          onClick={() => run("token")}
        >
          <KeyRound className="size-4" />
          {busy === "token" ? "Gerando..." : verifyToken ? "Gerar outro verify token" : "Gerar verify token"}
        </Button>
        {!webhookUrl.startsWith("https://") && (
          <p className="text-xs text-warning">
            A Meta só aceita webhook em HTTPS público. Em localhost, use um túnel (ex.: ngrok) ou configure já com o
            CRM em produção.
          </p>
        )}
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">2. Credenciais do app na Meta</h3>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wa-cloud-phone-id">Phone Number ID</Label>
          <Input id="wa-cloud-phone-id" placeholder="Ex.: 1234567890123456" autoComplete="off" {...register("phoneNumberId")} />
          {errors.phoneNumberId && <p className="text-xs text-destructive">{errors.phoneNumberId.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wa-cloud-token">Token de acesso permanente</Label>
          <Input
            id="wa-cloud-token"
            type="password"
            autoComplete="off"
            placeholder={hasAccessToken ? "Já salvo — deixe em branco pra manter" : "EAAG..."}
            {...register("accessToken")}
          />
          {errors.accessToken && <p className="text-xs text-destructive">{errors.accessToken.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wa-cloud-secret">App Secret (Chave secreta do app)</Label>
          <Input
            id="wa-cloud-secret"
            type="password"
            autoComplete="off"
            placeholder={hasAppSecret ? "Já salvo — deixe em branco pra manter" : "32 caracteres"}
            {...register("appSecret")}
          />
          {errors.appSecret && <p className="text-xs text-destructive">{errors.appSecret.message}</p>}
          <p className="text-xs text-muted-foreground">
            Usado pra confirmar que cada mensagem recebida veio mesmo da Meta. Sem ele, nada é recebido.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={isSubmitting || isPending}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
          {configured && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null || isPending}
              onClick={() => run("remove")}
            >
              {busy === "remove" ? "Removendo..." : "Remover configuração"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

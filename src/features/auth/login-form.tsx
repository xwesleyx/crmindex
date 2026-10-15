"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { getSession, signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookPanel } from "@/components/brand/book-panel";
import { loginSchema, type LoginInput } from "@/features/auth/schema";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [formError, setFormError] = useState<string | null>(null);
  // null = form ainda ativo; string = login ok, assinatura animando no
  // documento (mesmo vazia, caso a conta não tenha nome).
  const [signedInName, setSignedInName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setFormError(null);
    const result = await signIn("credentials", {
      ...data,
      redirect: false,
    });

    if (!result || result.error) {
      setFormError("E-mail ou senha inválidos.");
      return;
    }

    // Sessão só fica disponível depois do signIn resolver — busca aqui pra
    // ter o nome de quem logou antes de animar a assinatura e só então
    // navegar pro dashboard.
    const session = await getSession();
    setSignedInName(session?.user?.name ?? "");
  }

  const locked = signedInName !== null;

  return (
    <div className="relative min-h-screen">
      {/* Fundo em tela cheia — a marca INDEX já aparece dentro da própria
          foto, por isso o <h1> real fica escondido (só leitor de tela) lá em
          (auth)/layout.tsx. Some no celular: o object-fit:cover de uma foto
          2:1 recorta demais uma tela alta e estreita, então prioriza o
          formulário sozinho num fundo liso nesse tamanho. */}
      <BookPanel
        signingName={signedInName}
        onDone={() => {
          router.push(callbackUrl);
          router.refresh();
        }}
        className="fixed inset-0 hidden sm:block motion-safe:animate-[fade-in-up_0.7s_ease-out]"
      />

      <div className="relative z-10 flex min-h-screen items-center px-6 py-10 sm:px-10 lg:pl-[8%] xl:pl-[10%]">
        <Card className="w-full max-w-sm rounded-2xl border-0 py-8 ring-1 ring-foreground/[0.06] shadow-[0_20px_45px_-22px_rgba(16,26,44,0.2)] motion-safe:animate-[fade-in-up_0.6s_ease-out]">
          <CardContent className="flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Bem-vindo(a)!</h2>
              <p className="mt-1 text-sm text-muted-foreground">Faça login para acessar o seu painel.</p>
            </div>

            {/* method="post" é rede de segurança: se o clique acontecer antes do
                JS terminar de hidratar (comum em conexões mais lentas pela rede),
                o navegador ainda envia por POST em vez de vazar a senha na URL
                via GET. O fluxo normal continua sendo o onSubmit via JS abaixo. */}
            <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail ou usuário</Label>
                <div className="relative">
                  <Mail
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="voce@empresa.com ou admin"
                    disabled={locked}
                    aria-invalid={!!errors.email}
                    className="h-11 rounded-xl pl-9 text-[0.95rem]"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    disabled={locked}
                    aria-invalid={!!errors.password}
                    className="h-11 rounded-xl pr-10 pl-9 text-[0.95rem]"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={locked}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || locked}
                className="mt-2 h-11 w-full gap-1.5 rounded-xl text-[0.95rem] shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
              >
                {isSubmitting || locked ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

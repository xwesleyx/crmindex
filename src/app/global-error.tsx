"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white text-center font-sans">
        <p className="text-lg font-semibold text-slate-900">
          Algo deu errado
        </p>
        <p className="text-sm text-slate-500">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}

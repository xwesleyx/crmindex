"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthError({
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar esta página. Tente novamente.
          </p>
          <Button variant="outline" onClick={reset}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

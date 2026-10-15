import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center">
      <FileQuestion className="size-10 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">Página não encontrada</p>
        <p className="text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard">Voltar ao início</Link>} />
    </div>
  );
}

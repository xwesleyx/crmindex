"use client";

import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/components/entity-avatar";

const AVATAR_SIZE_PX = 256;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

// Recorta o centro da foto num quadrado e reduz pra 256x256 (JPEG) no
// próprio navegador — o que vai pro servidor fica com ~20 KB, qualquer que
// seja o tamanho da foto original.
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas indisponível");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE_PX,
    AVATAR_SIZE_PX
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

// Foto de perfil com "Trocar foto" / "Remover" — salva na hora (não espera
// o "Salvar" do formulário em volta). Usado em Meu perfil e em
// Configurações > Usuários > Editar.
export function AvatarUploader({
  name,
  currentSrc,
  onSave,
}: {
  name: string;
  currentSrc: string | null;
  onSave: (image: string | null) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Prévia local logo após escolher/remover, sem esperar o refresh.
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const shownSrc = preview === undefined ? currentSrc : preview;

  function save(image: string | null) {
    startTransition(async () => {
      const result = await onSave(image);
      if (!result.success) {
        setPreview(undefined);
        toast.error("Não foi possível salvar a foto", { description: result.error });
        return;
      }
      toast.success(image ? "Foto de perfil atualizada" : "Foto de perfil removida", {
        description: image
          ? "A nova foto já aparece no topo da tela e na lista de usuários."
          : "No lugar da foto voltam a aparecer as iniciais do nome.",
      });
      router.refresh();
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("Imagem muito grande (máximo 15 MB).");
      return;
    }
    try {
      const dataUrl = await toAvatarDataUrl(file);
      setPreview(dataUrl);
      save(dataUrl);
    } catch {
      toast.error("Não foi possível ler esta imagem. Tente outra foto.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {shownSrc && <AvatarImage src={shownSrc} alt={`Foto de ${name}`} />}
        <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => inputRef.current?.click()}>
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            {shownSrc ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {shownSrc && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setPreview(null);
                save(null);
              }}
            >
              <Trash2 className="size-3.5" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP. A foto é recortada em quadrado.</p>
      </div>
    </div>
  );
}

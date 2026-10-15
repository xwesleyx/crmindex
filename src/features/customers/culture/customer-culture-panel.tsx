"use client";

import type { Editor } from "@tiptap/react";
import { AlertTriangle, FilePlus2, Loader2, NotebookPen, Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { saveCustomerCulture, saveCustomerCultureAlert } from "@/features/customers/culture/actions";
import { CultureEditor } from "@/features/customers/culture/culture-editor";
import { CultureViewer } from "@/features/customers/culture/culture-viewer";
import { CULTURE_TEMPLATE_HTML } from "@/features/customers/culture/extensions";
import { CULTURE_ALERT_MAX, hasCultureContent } from "@/features/customers/culture/schema";
import type { CustomerCulture } from "@/features/customers/culture/queries";

export function CustomerCulturePanel({ culture, canEdit }: { culture: CustomerCulture; canEdit: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <AlertCard culture={culture} canEdit={canEdit} />
      <DocumentCard culture={culture} canEdit={canEdit} />
    </div>
  );
}

function AlertCard({ culture, canEdit }: { culture: CustomerCulture; canEdit: boolean }) {
  const [value, setValue] = useState(culture.alert ?? "");
  const [isPending, startTransition] = useTransition();
  const changed = value.trim() !== (culture.alert ?? "");

  function save() {
    startTransition(async () => {
      const result = await saveCustomerCultureAlert(culture.customerId, value);
      if (result.success) toast.success(value.trim() ? "Aviso salvo." : "Aviso removido.");
      else toast.error(result.error);
    });
  }

  return (
    <Card size="sm" className="border-l-4 border-l-amber-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          Aviso em destaque
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Uma frase curta que aparece em destaque no topo do Atendimento sempre que alguém deste cliente chamar (ex.:
          &quot;Não criar usuários sem autorização do Carlos&quot;).
        </p>
        {canEdit ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={value}
              maxLength={CULTURE_ALERT_MAX}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Sem aviso"
              onKeyDown={(event) => {
                if (event.key === "Enter" && changed) save();
              }}
            />
            <Button size="sm" disabled={!changed || isPending} onClick={save} className="shrink-0">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar aviso
            </Button>
          </div>
        ) : (
          <p className="text-sm font-medium">{culture.alert || "Sem aviso."}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentCard({ culture, canEdit }: { culture: CustomerCulture; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const editorRef = useRef<Editor | null>(null);
  const content = culture.content ?? "";
  const hasContent = hasCultureContent(content);

  function save() {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.getHTML();
    startTransition(async () => {
      const result = await saveCustomerCulture(culture.customerId, html);
      if (!result.success) {
        toast.error("Não foi possível salvar", { description: result.error });
        return;
      }
      toast.success("Cultura/Modelo salva.", { description: "Já aparece no Atendimento deste cliente." });
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    const editor = editorRef.current;
    const changed = editor && editor.getHTML() !== (content || "<p></p>");
    if (changed && !window.confirm("Descartar as alterações que não foram salvas?")) return;
    setEditing(false);
  }

  function insertTemplate() {
    const editor = editorRef.current;
    if (!editor) return;
    if (hasCultureContent(editor.getHTML())) {
      editor.chain().focus("end").insertContent(CULTURE_TEMPLATE_HTML).run();
    } else {
      editor.commands.setContent(CULTURE_TEMPLATE_HTML);
      editor.commands.focus("start");
    }
  }

  return (
    <Card size="sm">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <NotebookPen className="size-4" />
            Cultura/Modelo
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {culture.updatedAt
              ? `Atualizado ${culture.updatedByName ? `por ${culture.updatedByName} ` : ""}em ${formatDateTime(culture.updatedAt)}`
              : "Como esta empresa funciona — regras, acessos, pessoas-chave, observações."}
          </p>
        </div>
        {canEdit &&
          (editing ? (
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" disabled={isPending} onClick={cancel}>
                <X className="size-4" />
                Cancelar
              </Button>
              <Button size="sm" disabled={isPending} onClick={save}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Salvar
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              {hasContent ? "Editar" : "Escrever"}
            </Button>
          ))}
      </CardHeader>
      <CardContent>
        {editing ? (
          <CultureEditor
            initialContent={content}
            onReady={(editor) => {
              editorRef.current = editor;
            }}
            toolbarExtra={
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={insertTemplate}
                title="Inserir um roteiro com seções sugeridas"
                className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium hover:bg-muted"
              >
                <FilePlus2 className="size-3.5" />
                Inserir modelo
              </button>
            }
          />
        ) : hasContent ? (
          <CultureViewer content={content} className="px-1" />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center">
            <NotebookPen className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nada escrito ainda</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Registre aqui como esta empresa funciona: o que pode e o que não pode, acessos (VPN, servidores),
              pessoas-chave e observações. Quem atender este cliente vê tudo isso direto na conversa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

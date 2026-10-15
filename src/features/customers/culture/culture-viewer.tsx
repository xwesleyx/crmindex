"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { cn } from "cn";

import { cultureExtensions } from "@/features/customers/culture/extensions";

// Mostra o documento Cultura/Modelo só para leitura. Usa o próprio editor
// (não innerHTML): ele reconstrói o conteúdo pelas extensões conhecidas e
// descarta o resto — ver extensions.ts.
export function CultureViewer({ content, className }: { content: string; className?: string }) {
  const editor = useEditor({
    extensions: cultureExtensions(),
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: cn("rich-content outline-none", className) } },
  });

  // Conteúdo salvo de novo (router.refresh) sem desmontar o componente.
  useEffect(() => {
    if (editor && editor.getHTML() !== content) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  if (!editor) return <div className="h-24 animate-pulse rounded-lg bg-muted" />;
  return <EditorContent editor={editor} />;
}

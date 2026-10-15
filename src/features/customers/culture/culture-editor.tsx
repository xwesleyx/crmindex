"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cultureExtensions } from "@/features/customers/culture/extensions";

const FONT_FAMILIES = [
  { label: "Padrão", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px"];

const TEXT_COLORS = [
  "#000000",
  "#4b5563",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e5e7eb"];

function ToolbarButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // onMouseDown + preventDefault: não tira o foco/seleção do texto.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted disabled:opacity-40",
        active && "bg-primary/15 text-primary"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Separator() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function ColorPopover({
  icon,
  label,
  colors,
  current,
  onPick,
  onClear,
  clearLabel,
}: {
  icon: LucideIcon;
  label: string;
  colors: string[];
  current: string | null;
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  const Icon = icon;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            className="flex size-8 flex-col items-center justify-center gap-0.5 rounded-md text-foreground/80 hover:bg-muted"
          />
        }
      >
        <Icon className="size-3.5" />
        <span className="h-1 w-4 rounded-full" style={{ backgroundColor: current ?? "currentColor" }} />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(color)}
              className={cn(
                "size-6 rounded-md ring-1 ring-foreground/15 transition-transform hover:scale-110",
                current === color && "ring-2 ring-primary"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClear}
          className="mt-2 w-full rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          {clearLabel}
        </button>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor, extra }: { editor: Editor; extra?: ReactNode }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 1 })
        ? "h1"
        : e.isActive("heading", { level: 2 })
          ? "h2"
          : e.isActive("heading", { level: 3 })
            ? "h3"
            : "p",
      fontFamily: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      fontSize: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      highlight: (e.getAttributes("highlight").color as string | undefined) ?? null,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      align: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      taskList: e.isActive("taskList"),
      blockquote: e.isActive("blockquote"),
      inTable: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  function setBlock(value: string) {
    if (value === "p") chain().setParagraph().run();
    else chain().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  }

  function editLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt("Endereço do link (deixe vazio para remover):", previous);
    if (url === null) return;
    if (url.trim() === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const selectClass =
    "h-8 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:border-ring";

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur">
      <ToolbarButton icon={Undo2} label="Desfazer" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <ToolbarButton icon={Redo2} label="Refazer" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      <Separator />
      <select
        aria-label="Estilo"
        value={state.block}
        onChange={(event) => setBlock(event.target.value)}
        className={cn(selectClass, "w-28")}
      >
        <option value="p">Texto normal</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>
      <select
        aria-label="Fonte"
        value={FONT_FAMILIES.some((f) => f.value === state.fontFamily) ? state.fontFamily : ""}
        onChange={(event) =>
          event.target.value
            ? chain().setFontFamily(event.target.value).run()
            : chain().unsetFontFamily().run()
        }
        className={cn(selectClass, "w-32")}
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font.label} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Tamanho da fonte"
        value={state.fontSize}
        onChange={(event) =>
          event.target.value ? chain().setFontSize(event.target.value).run() : chain().unsetFontSize().run()
        }
        className={cn(selectClass, "w-[4.5rem]")}
      >
        <option value="">Tam.</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>
      <Separator />
      <ToolbarButton icon={Bold} label="Negrito (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton
        icon={Italic}
        label="Itálico (Ctrl+I)"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolbarButton
        icon={Underline}
        label="Sublinhado (Ctrl+U)"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label="Tachado"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ColorPopover
        icon={Baseline}
        label="Cor do texto"
        colors={TEXT_COLORS}
        current={state.color}
        onPick={(color) => chain().setColor(color).run()}
        onClear={() => chain().unsetColor().run()}
        clearLabel="Cor padrão"
      />
      <ColorPopover
        icon={Highlighter}
        label="Marca-texto"
        colors={HIGHLIGHT_COLORS}
        current={state.highlight}
        onPick={(color) => chain().setHighlight({ color }).run()}
        onClear={() => chain().unsetHighlight().run()}
        clearLabel="Sem marca-texto"
      />
      <Separator />
      <ToolbarButton
        icon={AlignLeft}
        label="Alinhar à esquerda"
        active={state.align === "left"}
        onClick={() => chain().setTextAlign("left").run()}
      />
      <ToolbarButton
        icon={AlignCenter}
        label="Centralizar"
        active={state.align === "center"}
        onClick={() => chain().setTextAlign("center").run()}
      />
      <ToolbarButton
        icon={AlignRight}
        label="Alinhar à direita"
        active={state.align === "right"}
        onClick={() => chain().setTextAlign("right").run()}
      />
      <ToolbarButton
        icon={AlignJustify}
        label="Justificar"
        active={state.align === "justify"}
        onClick={() => chain().setTextAlign("justify").run()}
      />
      <Separator />
      <ToolbarButton
        icon={List}
        label="Lista com marcadores"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Lista numerada"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={ListChecks}
        label="Lista de verificação"
        active={state.taskList}
        onClick={() => chain().toggleTaskList().run()}
      />
      <ToolbarButton
        icon={Quote}
        label="Citação / destaque"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarButton icon={Minus} label="Linha divisória" onClick={() => chain().setHorizontalRule().run()} />
      <ToolbarButton icon={Link2} label="Link" active={state.link} onClick={editLink} />
      <ToolbarButton
        icon={Table}
        label="Inserir tabela"
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      <ToolbarButton
        icon={RemoveFormatting}
        label="Limpar formatação"
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      />
      {extra}
      {state.inTable && (
        <div className="flex w-full flex-wrap items-center gap-1 pt-1 text-xs">
          <span className="text-muted-foreground">Tabela:</span>
          {[
            { label: "+ linha", run: () => chain().addRowAfter().run() },
            { label: "+ coluna", run: () => chain().addColumnAfter().run() },
            { label: "− linha", run: () => chain().deleteRow().run() },
            { label: "− coluna", run: () => chain().deleteColumn().run() },
            { label: "Apagar tabela", run: () => chain().deleteTable().run() },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={action.run}
              className="rounded-md border border-border px-2 py-0.5 hover:bg-muted"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Editor do documento Cultura/Modelo. `onReady` entrega a instância pra quem
// precisa ler o HTML (botão Salvar) ou inserir o modelo.
export function CultureEditor({
  initialContent,
  onReady,
  toolbarExtra,
}: {
  initialContent: string;
  onReady: (editor: Editor) => void;
  toolbarExtra?: ReactNode;
}) {
  const editor = useEditor({
    extensions: cultureExtensions({
      placeholder: "Escreva como esta empresa funciona, regras, acessos, observações...",
    }),
    content: initialContent,
    // Renderiza só no navegador (evita diferença de HTML na hidratação).
    immediatelyRender: false,
    autofocus: "end",
    editorProps: { attributes: { class: "rich-content min-h-80 px-5 py-4 outline-none" } },
    onCreate: ({ editor: created }) => onReady(created),
  });

  if (!editor) return <div className="min-h-80 animate-pulse rounded-lg bg-muted" />;

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring">
      <Toolbar editor={editor} extra={toolbarExtra} />
      <EditorContent editor={editor} />
    </div>
  );
}

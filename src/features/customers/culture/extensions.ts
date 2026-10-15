import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";

// Extensões do documento "Cultura/Modelo" — as MESMAS no editor e na
// visualização (ficha do cliente e Atendimento). É isso que torna o HTML
// salvo seguro de mostrar: o editor só reconstrói o que estas extensões
// conhecem (texto, títulos, listas, tabelas, cores...) e descarta qualquer
// outra tag/atributo; links só com http(s)/mailto/tel.
export function cultureExtensions({ placeholder }: { placeholder?: string } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto", "tel"],
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
      },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}

// Ponto de partida sugerido ("Inserir modelo" no editor).
export const CULTURE_TEMPLATE_HTML = `
<h2>Como a empresa funciona</h2>
<p>Ramo, porte, horário de funcionamento, como preferem ser atendidos...</p>
<h2>Regras e restrições</h2>
<ul>
  <li><p><strong>Não</strong> criar funcionário/usuário sem autorização de ...</p></li>
  <li><p>...</p></li>
</ul>
<h2>Acessos e infraestrutura</h2>
<p>VPN própria, servidores, sistemas que usam, onde ficam os equipamentos...</p>
<h2>Pessoas-chave</h2>
<table>
  <tr><th><p>Nome</p></th><th><p>Cargo</p></th><th><p>Quando procurar</p></th></tr>
  <tr><td><p></p></td><td><p></p></td><td><p></p></td></tr>
  <tr><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</table>
<h2>Observações</h2>
<p></p>
`;

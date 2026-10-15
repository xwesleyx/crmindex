import { z } from "zod";

export const regionFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da região"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida — use um código hex, ex: #3B82F6"),
});

export type RegionFormInput = z.infer<typeof regionFormSchema>;

// Lê o param de URL "?regions=id1,id2" (padrão reusado em Kanban comercial,
// Kanban de instalação, Dashboard e Relatórios) — ausente/vazio = null
// (sem filtro, mesmo "Todas" pré-selecionado do filtro de categorias da
// Agenda).
export function parseRegionIds(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : null;
}

import { z } from "zod";

export const kanbanStageFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da etapa"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida — use um hex de 6 dígitos"),
});

export type KanbanStageFormInput = z.infer<typeof kanbanStageFormSchema>;

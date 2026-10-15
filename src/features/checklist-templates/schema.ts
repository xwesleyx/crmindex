import { z } from "zod";

export const checklistTemplateItemFormSchema = z.object({
  label: z.string().trim().min(2, "Informe o texto do item"),
  required: z.boolean(),
});

export type ChecklistTemplateItemFormInput = z.infer<typeof checklistTemplateItemFormSchema>;

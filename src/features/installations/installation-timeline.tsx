import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";

const FIELD_LABELS: Record<string, string> = {
  priority: "prioridade",
  scheduledAt: "data agendada",
  dueAt: "prazo",
  notes: "observações",
};

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "installation.created_from_sale":
      return "instalação criada a partir da venda";
    case "installation.stage_change":
      return `moveu de "${metadata.fromStageName}" para "${metadata.toStageName}"`;
    case "installation.responsible_change":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "installation.completed":
      return "instalação concluída";
    case "installation.checklist_item_completed":
      return `concluiu o item do checklist "${metadata.label}"`;
    case "installation.checklist_item_reopened":
      return `reabriu o item do checklist "${metadata.label}"`;
    case "installation.checklist_item_added":
      return `adicionou o item "${metadata.label}" ao checklist`;
    case "installation.checklist_finished":
      return "concluiu todos os itens do checklist";
    case "installation.updated": {
      const fields = (metadata.fields as string[] | undefined) ?? [];
      const labels = fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
      return labels ? `atualizou: ${labels}` : "atualizou a instalação";
    }
    case "task.created":
      return `criou a tarefa "${metadata.title}"`;
    case "task.completed":
      return `concluiu a tarefa "${metadata.title}"`;
    case "task.reopened":
      return `reabriu a tarefa "${metadata.title}"`;
    default:
      return activity.action;
  }
}

export function InstallationTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

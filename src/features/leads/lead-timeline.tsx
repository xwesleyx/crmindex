import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";
import {
  LEAD_FIELD_LABELS,
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/features/leads/labels";
import type { LeadStatus, Priority } from "@prisma/client";

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "lead.create":
      return "criou o lead";
    case "lead.archive":
      return "arquivou o lead";
    case "lead.restore":
      return "restaurou o lead";
    case "lead.status_change":
      return `alterou o status: ${LEAD_STATUS_LABELS[metadata.from as LeadStatus]} → ${LEAD_STATUS_LABELS[metadata.to as LeadStatus]}`;
    case "lead.priority_change":
      return `alterou a prioridade: ${PRIORITY_LABELS[metadata.from as Priority]} → ${PRIORITY_LABELS[metadata.to as Priority]}`;
    case "lead.responsible_change":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "lead.update": {
      const fields = (metadata.fields as string[] | undefined) ?? [];
      const labels = fields.map((f) => LEAD_FIELD_LABELS[f] ?? f).join(", ");
      return labels ? `atualizou: ${labels}` : "atualizou o lead";
    }
    case "lead.converted":
      return "converteu o lead em oportunidade";
    default:
      return activity.action;
  }
}

export function LeadTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";
import { formatMoneyCents } from "@/lib/money";
import { LOSS_REASON_LABELS, PRIORITY_LABELS } from "@/features/opportunities/labels";
import type { LossReason, Priority } from "@prisma/client";

const FIELD_LABELS: Record<string, string> = {
  title: "título",
  contactId: "contato",
  companyId: "empresa",
  origin: "origem",
  recurringValueCents: "valor recorrente",
  expectedCloseAt: "previsão de fechamento",
  lastInteractionAt: "última interação",
  description: "descrição",
  notes: "observações",
};

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "opportunity.created":
      return "criou a oportunidade";
    case "opportunity.created_from_lead":
      return "criou a oportunidade a partir de um lead convertido";
    case "opportunity.stage_change":
      return `moveu de "${metadata.fromStageName}" para "${metadata.toStageName}"`;
    case "opportunity.value_change":
      return `alterou o valor: ${formatMoneyCents(metadata.from)} → ${formatMoneyCents(metadata.to)}`;
    case "opportunity.priority_change":
      return `alterou a prioridade: ${PRIORITY_LABELS[metadata.from as Priority]} → ${PRIORITY_LABELS[metadata.to as Priority]}`;
    case "opportunity.responsible_change":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "opportunity.won":
      return "marcou como Venda Ganha";
    case "opportunity.lost":
      return `marcou como Venda Perdida — motivo: ${LOSS_REASON_LABELS[metadata.reason as LossReason]}${metadata.note ? ` (${metadata.note})` : ""}`;
    case "opportunity.updated": {
      const fields = (metadata.fields as string[] | undefined) ?? [];
      const labels = fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
      return labels ? `atualizou: ${labels}` : "atualizou a oportunidade";
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

export function OpportunityTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";
import { formatMoneyCents } from "@/lib/money";

const FIELD_LABELS: Record<string, string> = {
  discountCents: "desconto",
  recurringAmountCents: "valor recorrente",
  paymentMethod: "forma de pagamento",
  notes: "observações",
};

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "sale.created_from_opportunity":
      return `venda registrada a partir da oportunidade — ${formatMoneyCents(metadata.amountCents ?? 0)}`;
    case "sale.updated": {
      const fields = (metadata.fields as string[] | undefined) ?? [];
      const labels = fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
      return labels ? `atualizou: ${labels}` : "venda atualizada";
    }
    default:
      return activity.action;
  }
}

export function SaleTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

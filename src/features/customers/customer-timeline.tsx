import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "customer.created_manually":
      return "cadastrou o cliente manualmente";
    case "customer.created_from_company":
      return "tornou a empresa cliente";
    case "customer.created_from_opportunity":
      return "virou cliente a partir de uma oportunidade ganha";
    case "customer.activated":
      return "reativou o cliente";
    case "customer.deactivated":
      return "desativou o cliente";
    case "customer.responsible_change":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "customer.updated":
      return "atualizou as observações";
    case "customer.culture_updated":
      return "editou a Cultura/Modelo";
    case "customer.culture_alert_updated":
      return `definiu o aviso em destaque: "${metadata.alert ?? ""}"`;
    case "customer.culture_alert_removed":
      return "removeu o aviso em destaque";
    default:
      return activity.action;
  }
}

export function CustomerTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

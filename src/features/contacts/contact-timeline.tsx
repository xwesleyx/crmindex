import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";

const FIELD_LABELS: Record<string, string> = {
  name: "nome",
  phone: "telefone",
  whatsapp: "WhatsApp",
  email: "e-mail",
  role: "cargo",
  notes: "observações",
  isActive: "status ativo/inativo",
  origin: "origem",
  companyId: "empresa",
  lastInteractionAt: "última interação",
};

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "contact.created":
      return "criou o contato";
    case "contact.created_from_lead":
      return "criou o contato a partir da conversão de um lead";
    case "contact.archived":
      return "arquivou o contato";
    case "contact.restored":
      return "restaurou o contato";
    case "contact.responsible_change":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "contact.renamed":
      return `renomeou o contato: ${metadata.from ?? "—"} → ${metadata.to ?? "—"}`;
    case "contact.name_reverted":
      return `voltou ao nome do WhatsApp: ${metadata.from ?? "—"} → ${metadata.to ?? "—"}`;
    case "contact.updated": {
      const fields = (metadata.fields as string[] | undefined) ?? [];
      const labels = fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
      return labels ? `atualizou: ${labels}` : "atualizou o contato";
    }
    default:
      return activity.action;
  }
}

export function ContactTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

import { EntityTimeline, type ActivityWithUser } from "@/components/entity-timeline";
import { formatCNPJ } from "@/lib/format";

const FIELD_LABELS: Record<string, string> = {
  legalName: "razão social",
  tradeName: "nome fantasia",
  phone: "telefone",
  whatsapp: "WhatsApp",
  email: "e-mail",
  website: "site",
  addressLine: "endereço",
  addressNumber: "número",
  complement: "complemento",
  neighborhood: "bairro",
  city: "cidade",
  state: "estado",
  zipCode: "CEP",
  notes: "observações",
  isActive: "status ativo/inativo",
  origin: "origem",
};

function describeActivity(activity: ActivityWithUser): string {
  const metadata = activity.metadata ? JSON.parse(activity.metadata) : {};

  switch (activity.action) {
    case "company.converted_to_customer":
      return "tornou a empresa cliente";
    case "company.created":
      return "criou a empresa";
    case "company.created_from_lead":
      return "criou a empresa a partir da conversão de um lead";
    case "company.archived":
      return "arquivou a empresa";
    case "company.restored":
      return "restaurou a empresa";
    case "company.responsible_change":
      return `alterou o responsável: ${metadata.fromName ?? "Sem responsável"} → ${metadata.toName ?? "Sem responsável"}`;
    case "company.updated": {
      if (metadata.field === "cnpj") {
        return `alterou o CNPJ: ${formatCNPJ(metadata.from)} → ${formatCNPJ(metadata.to)}`;
      }
      const fields = (metadata.fields as string[] | undefined) ?? [];
      const labels = fields.map((f) => FIELD_LABELS[f] ?? f).join(", ");
      return labels ? `atualizou: ${labels}` : "atualizou a empresa";
    }
    default:
      return activity.action;
  }
}

export function CompanyTimeline({ activities }: { activities: ActivityWithUser[] }) {
  return <EntityTimeline activities={activities} describe={describeActivity} />;
}

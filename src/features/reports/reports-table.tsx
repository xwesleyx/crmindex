import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatPhone, formatRelative } from "@/lib/format";
import { getConversationDisplayStatus } from "@/features/atendimento/labels";
import type { ReportConversationItem } from "@/features/reports/queries";

export function ReportsTable({ conversations }: { conversations: ReportConversationItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contato</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Quem atendeu</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Última mensagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((conversation) => {
            const displayStatus = getConversationDisplayStatus(conversation);
            return (
              <TableRow key={conversation.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/relatorios/atendimentos/${conversation.id}`} className="block">
                    <span className="text-sm font-medium">{conversation.contact.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatPhone(conversation.contact.phone ?? conversation.contact.whatsapp)}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {conversation.contact.company
                    ? conversation.contact.company.tradeName || conversation.contact.company.legalName
                    : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {conversation.assignee?.name ?? "Sem responsável"}
                </TableCell>
                <TableCell>
                  <StatusBadge label={displayStatus.label} tone={displayStatus.tone} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelative(conversation.lastMessageAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

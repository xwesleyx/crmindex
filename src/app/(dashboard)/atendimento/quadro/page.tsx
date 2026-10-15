import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { AtendimentoBoard } from "@/features/atendimento/atendimento-board";
import { AtendimentoHeader } from "@/features/atendimento/atendimento-header";
import { getAtendimentoViewer } from "@/features/atendimento/permissions";
import { getAtendimentoBoard, listAtendimentoAssignableUsers } from "@/features/atendimento/queries";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

// Quadro (Kanban) da Central: Em atendimento / Aguardando cliente /
// Finalizados hoje, do próprio atendente — ou de qualquer um, pra quem tem
// "Ver atendimento de todos" (?atendente=<id>, sem ele = equipe toda).
export default async function AtendimentoBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ atendente?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);
  if (!isModuleVisible(session.user.role, "atendimento", permissionOverrides)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem acesso à Central de Atendimento."
      />
    );
  }

  const viewer = await getAtendimentoViewer(session.user);
  const { atendente } = await searchParams;
  const requested = typeof atendente === "string" && atendente ? atendente : null;

  const attendants = viewer.viewAll ? await listAtendimentoAssignableUsers() : null;
  const selectedAttendantId =
    viewer.viewAll && requested && attendants?.some((user) => user.id === requested) ? requested : null;

  const columns = await getAtendimentoBoard(viewer, selectedAttendantId);

  return (
    <div className="atendimento-theme flex h-[calc(100dvh-6.75rem)] min-h-[520px] flex-col gap-3">
      <AtendimentoHeader />
      <AtendimentoBoard
        columns={columns}
        attendants={attendants?.map((user) => ({ id: user.id, name: user.name })) ?? null}
        selectedAttendantId={selectedAttendantId}
        currentUserId={viewer.id}
      />
    </div>
  );
}

import { redirect } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { isModuleVisible } from "@/lib/permissions";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";

// "/relatorios" não é mais uma tela própria — vira o primeiro relatório que
// o papel do usuário tiver acesso (cada tipo agora é um módulo próprio, ver
// src/lib/permissions.ts).
export default async function ReportsIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const permissionOverrides = await getResolvedPermissionOverrides(session.user.id);

  if (isModuleVisible(session.user.role, "relatorios_atendimento", permissionOverrides)) redirect("/relatorios/atendimentos");
  if (isModuleVisible(session.user.role, "relatorios_comercial", permissionOverrides)) redirect("/relatorios/comercial");
  if (isModuleVisible(session.user.role, "relatorios_instalacoes", permissionOverrides)) redirect("/relatorios/instalacoes");

  return (
    <EmptyState
      icon={ShieldAlert}
      title="Acesso restrito"
      description="Seu perfil não tem acesso a nenhum relatório."
    />
  );
}

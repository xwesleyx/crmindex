import { redirect } from "next/navigation";
import { ShieldAlert, Users } from "lucide-react";

import { ROLE_LABELS } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityAvatar } from "@/components/entity-avatar";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/features/settings/settings-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateUserDialog } from "@/features/users/create-user-dialog";
import { EditUserDialog } from "@/features/users/edit-user-dialog";
import { UserStatusToggle } from "@/features/users/user-status-toggle";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPER_ADMIN_EMAIL, isSuperAdmin } from "@/lib/super-admin";
import { userAvatarSrc } from "@/lib/user-avatar";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar usuários."
      />
    );
  }

  const users = await prisma.user.findMany({
    // Usuário do suporte só aparece para ele mesmo (ver lib/super-admin.ts).
    where: {
      deletedAt: null,
      ...(isSuperAdmin(session.user.email) ? {} : { email: { not: SUPER_ADMIN_EMAIL } }),
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Usuários"
        tabs={<SettingsTabs group="usuarios" />}
        description="Quem acessa o CRM, com qual perfil e telefone de contato."
        action={<CreateUserDialog />}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum usuário cadastrado"
          description="Crie o primeiro usuário para começar a usar o sistema."
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <EntityAvatar name={user.name} tone="muted" src={userAvatarSrc(user)} />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {user.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{user.phone || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === "ACTIVE" ? "default" : "outline"}
                    >
                      {user.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditUserDialog
                        userId={user.id}
                        name={user.name}
                        email={user.email}
                        phone={user.phone}
                        avatarSrc={userAvatarSrc(user)}
                      />
                      <UserStatusToggle
                        userId={user.id}
                        status={user.status}
                        disabled={user.id === session.user.id}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

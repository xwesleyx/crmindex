import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";

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
import { EditPermissionsDialog } from "@/features/permissions/edit-permissions-dialog";
import { EDITABLE_MODULES, isModuleVisible, type CapabilityKey, type ModuleKey } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPER_ADMIN_EMAIL, isSuperAdmin } from "@/lib/super-admin";
import { userAvatarSrc } from "@/lib/user-avatar";

function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends object>(raw: string): T {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export default async function PermissoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "ADMIN") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Acesso restrito"
        description="Somente administradores podem gerenciar permissões."
      />
    );
  }

  const [users, overrides] = await Promise.all([
    prisma.user.findMany({
      // Usuário do suporte só aparece para ele mesmo (ver lib/super-admin.ts).
      where: {
        deletedAt: null,
        ...(isSuperAdmin(session.user.email) ? {} : { email: { not: SUPER_ADMIN_EMAIL } }),
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userPermissionOverride.findMany(),
  ]);
  const overrideByUserId = new Map(overrides.map((o) => [o.userId, o]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Usuários"
        tabs={<SettingsTabs group="usuarios" />}
        description="Escolha, para cada pessoa — inclusive Administradores —, quais telas ela vê e quais ações pode fazer. Configurações continua sempre liberada para Administradores."
      />

      {users.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhum usuário cadastrado"
          description="Crie usuários em Configurações > Usuários primeiro."
        />
      ) : (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const override = overrideByUserId.get(user.id);
                const modulesGranted = override ? parseJsonArray<ModuleKey>(override.modulesGranted) : [];
                const modulesRevoked = override ? parseJsonArray<ModuleKey>(override.modulesRevoked) : [];
                const capabilities = override
                  ? parseJsonObject<Partial<Record<CapabilityKey, boolean>>>(override.capabilities)
                  : {};
                const overrideCount =
                  modulesGranted.length + modulesRevoked.length + Object.keys(capabilities).length;
                const visibleCount = EDITABLE_MODULES.filter((key) =>
                  isModuleVisible(user.role, key, { modulesGranted, modulesRevoked, capabilities })
                ).length;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={user.name} tone="muted" src={userAvatarSrc(user)} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {user.role === "ADMIN" && overrideCount === 0 ? (
                          <Badge>Acesso total</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {visibleCount} de {EDITABLE_MODULES.length} telas
                          </span>
                        )}
                        {overrideCount > 0 && <Badge variant="outline">Personalizado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <EditPermissionsDialog
                        userId={user.id}
                        userName={user.name}
                        role={user.role}
                        roleLabel={ROLE_LABELS[user.role] ?? user.role}
                        initialModulesGranted={modulesGranted}
                        initialModulesRevoked={modulesRevoked}
                        initialCapabilities={capabilities}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

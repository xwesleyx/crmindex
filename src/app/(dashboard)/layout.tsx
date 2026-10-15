import { userAvatarSrc } from "@/lib/user-avatar";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AgendaRemindersProvider } from "@/features/atendimento-automation/agenda-reminders-context";
import { getAgendaWhatsappRemindersEnabled } from "@/features/atendimento-automation/settings";
import { auth } from "@/lib/auth";
import { getResolvedPermissionOverrides } from "@/lib/permission-overrides";
import { prisma } from "@/lib/prisma";
import { CURRENT_VERSION } from "@/lib/changelog";
import { isSuperAdmin } from "@/lib/super-admin";
import { LicenseLockedScreen, LicenseSupportBanner } from "@/features/license/license-screens";
import { UpdateBanner } from "@/features/license/update-banner";
import { canUpdateHere, getLicenseState, isNewerVersion } from "@/features/license/state";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Licença travada: só o usuário do suporte entra (ver lib/super-admin.ts).
  const license = await getLicenseState();
  const isSupport = isSuperAdmin(session.user.email);
  if (license.locked && !isSupport) return <LicenseLockedScreen state={license} />;
  const showUpdate = session.user.role === "ADMIN" && isNewerVersion(license.latest);

  const [
    unreadCount,
    currentUser,
    permissionOverrides,
    whatsappRemindersEnabled,
  ] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, phone: true, image: true, updatedAt: true },
    }),
    getResolvedPermissionOverrides(session.user.id),
    getAgendaWhatsappRemindersEnabled(),
  ]);

  return (
    <AgendaRemindersProvider enabled={whatsappRemindersEnabled}>
      <DashboardShell
        user={{
          name: session.user.name ?? session.user.email ?? "Usuário",
          email: session.user.email ?? "",
          role: session.user.role,
          phone: currentUser?.phone ?? null,
          avatarSrc: currentUser ? userAvatarSrc(currentUser) : null,
        }}
        unreadCount={unreadCount}
        permissionOverrides={permissionOverrides}
        systemBanner={
          <>
            {license.locked && isSupport && <LicenseSupportBanner state={license} />}
            {showUpdate && license.latest && (
              <UpdateBanner latest={license.latest} currentVersion={CURRENT_VERSION} canUpdate={canUpdateHere()} />
            )}
          </>
        }
      >
        {children}
      </DashboardShell>
    </AgendaRemindersProvider>
  );
}

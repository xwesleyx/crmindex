"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { isValidCNPJ } from "@/lib/validators";
import {
  canUpdateHere,
  checkLicenseNow,
  getLicenseState,
  isNewerVersion,
  requestUpdate,
  setLicenseCnpj,
} from "@/features/license/state";

type ActionResult = { success: true; message?: string } | { success: false; error: string };

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.email)) return null;
  return session;
}

export async function saveLicenseCnpj(cnpj: string): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  if (!session) return { success: false, error: "Somente o usuário do suporte pode alterar a licença." };

  const digits = String(cnpj ?? "").replace(/\D/g, "");
  if (!isValidCNPJ(digits)) return { success: false, error: "CNPJ inválido." };

  await setLicenseCnpj(digits, session.user.id);
  await logActivity({
    userId: session.user.id,
    action: "license.cnpj_updated",
    entityType: "AppSetting",
    entityId: "license",
  });
  // Já confere com o arquivo do GitHub pra mostrar a situação nova.
  await checkLicenseNow();
  revalidatePath("/", "layout");
  const state = await getLicenseState();
  return {
    success: true,
    message: state.locked ? "CNPJ salvo, mas ele não está na lista de ativos — o CRM continua travado." : "CNPJ salvo.",
  };
}

export async function checkLicense(): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  if (!session) return { success: false, error: "Somente o usuário do suporte pode verificar a licença." };
  const result = await checkLicenseNow();
  revalidatePath("/", "layout");
  if (!result.ok) return { success: false, error: result.error ?? "Falha ao consultar o GitHub." };
  const state = await getLicenseState();
  return { success: true, message: state.locked ? "Consultado: CNPJ não está ativo." : "Consultado: licença ativa." };
}

// "Atualizar agora" (aviso de versão nova) — qualquer administrador.
export async function requestUpdateNow(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Somente administradores podem atualizar o sistema." };
  }
  if (!canUpdateHere()) return { success: false, error: "Atualização só funciona no CRM instalado." };
  const state = await getLicenseState();
  if (!isNewerVersion(state.latest)) return { success: false, error: "O sistema já está na versão mais nova." };

  await requestUpdate(session.user.name ?? session.user.email ?? "admin");
  await logActivity({
    userId: session.user.id,
    action: "system.update_requested",
    entityType: "AppSetting",
    entityId: "update",
    metadata: { versao: state.latest.numero },
  });
  return { success: true };
}

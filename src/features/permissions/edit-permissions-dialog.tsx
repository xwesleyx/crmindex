"use client";

import type { UserRole } from "@prisma/client";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MODULE_LABELS } from "@/features/help/content";
import { updateUserPermissionOverride } from "@/features/permissions/actions";
import { CAPABILITY_LABELS } from "@/features/permissions/labels";
import {
  CAPABILITIES,
  EDITABLE_MODULES,
  canAccessModule,
  roleHasCapability,
  type CapabilityKey,
  type ModuleKey,
} from "@/lib/permissions";

const CAPABILITY_KEYS = Object.values(CAPABILITIES) as CapabilityKey[];

type Toggles<K extends string> = Record<K, boolean>;

// Estado efetivo (o que a pessoa vê/faz hoje) = padrão do perfil + ajustes.
function buildModuleToggles(role: UserRole, granted: ModuleKey[], revoked: ModuleKey[]): Toggles<ModuleKey> {
  return Object.fromEntries(
    EDITABLE_MODULES.map((key) => [
      key,
      revoked.includes(key) ? false : granted.includes(key) ? true : canAccessModule(role, key),
    ])
  ) as Toggles<ModuleKey>;
}

function buildCapabilityToggles(
  role: UserRole,
  capabilities: Partial<Record<CapabilityKey, boolean>>
): Toggles<CapabilityKey> {
  return Object.fromEntries(
    CAPABILITY_KEYS.map((key) => [key, capabilities[key] ?? roleHasCapability(role, key)])
  ) as Toggles<CapabilityKey>;
}

function ToggleRow({
  id,
  label,
  checked,
  isDefault,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  isDefault: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col">
        <span className="text-sm text-foreground">{label}</span>
        {!isDefault && <span className="text-[11px] text-primary">Diferente do padrão do perfil</span>}
      </label>
      <div className="flex items-center gap-2">
        <span className={checked ? "text-xs font-medium text-primary" : "text-xs text-muted-foreground"}>
          {checked ? "On" : "Off"}
        </span>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

export function EditPermissionsDialog({
  userId,
  userName,
  role,
  roleLabel,
  initialModulesGranted,
  initialModulesRevoked,
  initialCapabilities,
}: {
  userId: string;
  userName: string;
  role: UserRole;
  roleLabel: string;
  initialModulesGranted: ModuleKey[];
  initialModulesRevoked: ModuleKey[];
  initialCapabilities: Partial<Record<CapabilityKey, boolean>>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState(() =>
    buildModuleToggles(role, initialModulesGranted, initialModulesRevoked)
  );
  const [capabilities, setCapabilities] = useState(() => buildCapabilityToggles(role, initialCapabilities));

  function resetToInitial() {
    setModules(buildModuleToggles(role, initialModulesGranted, initialModulesRevoked));
    setCapabilities(buildCapabilityToggles(role, initialCapabilities));
  }

  function resetToRoleDefault() {
    setModules(buildModuleToggles(role, [], []));
    setCapabilities(buildCapabilityToggles(role, {}));
  }

  async function handleSave() {
    setSaving(true);
    // Grava só o que diverge do perfil — se o perfil mudar depois, o resto
    // acompanha o padrão novo.
    const modulesGranted = EDITABLE_MODULES.filter((key) => modules[key] && !canAccessModule(role, key));
    const modulesRevoked = EDITABLE_MODULES.filter((key) => !modules[key] && canAccessModule(role, key));
    const capabilityOverrides: Record<string, boolean> = Object.fromEntries(
      CAPABILITY_KEYS.filter((key) => capabilities[key] !== roleHasCapability(role, key)).map((key) => [
        key,
        capabilities[key],
      ])
    );

    const result = await updateUserPermissionOverride(userId, {
      modulesGranted,
      modulesRevoked,
      capabilities: capabilityOverrides,
    });
    setSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`Permissões de ${userName} atualizadas.`);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetToInitial();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <ShieldCheck className="size-3.5" />
            Permissões
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permissões de {userName}</DialogTitle>
          <DialogDescription>
            Ligue ou desligue o que esta pessoa pode ver e fazer. Já vem marcado o padrão do perfil{" "}
            <b>{roleLabel}</b>; mude só o que precisar.
          </DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Telas — o que pode ver
          </h3>
          <div className="divide-y divide-border">
            {EDITABLE_MODULES.map((key) => (
              <ToggleRow
                key={key}
                id={`perm-${userId}-${key}`}
                label={MODULE_LABELS[key]}
                checked={modules[key]}
                isDefault={modules[key] === canAccessModule(role, key)}
                onChange={(value) => setModules((prev) => ({ ...prev, [key]: value }))}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Ações — o que pode fazer
          </h3>
          <div className="divide-y divide-border">
            {CAPABILITY_KEYS.map((key) => (
              <ToggleRow
                key={key}
                id={`perm-${userId}-${key}`}
                label={CAPABILITY_LABELS[key]}
                checked={capabilities[key]}
                isDefault={capabilities[key] === roleHasCapability(role, key)}
                onChange={(value) => setCapabilities((prev) => ({ ...prev, [key]: value }))}
              />
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          {role === "ADMIN"
            ? "Configurações (usuários, permissões, integrações) continua sempre liberada para Administradores — assim ninguém perde o acesso a esta tela."
            : "Configurações (usuários, permissões, integrações) é exclusiva de Administrador."}
        </p>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={resetToRoleDefault} disabled={saving}>
            <RotateCcw className="size-3.5" />
            Voltar ao padrão do perfil
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

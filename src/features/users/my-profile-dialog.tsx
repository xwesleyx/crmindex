"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnAvatar, updateOwnProfile } from "@/features/users/actions";
import { AvatarUploader } from "@/features/users/avatar-uploader";
import { updateOwnProfileSchema, type UpdateOwnProfileInput } from "@/features/users/schema";
import { useAgendaWhatsappRemindersEnabled } from "@/features/atendimento-automation/agenda-reminders-context";

export function MyProfileDialog({
  open,
  onOpenChange,
  name,
  email,
  phone,
  avatarSrc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  email: string;
  phone: string | null;
  avatarSrc: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();
  const whatsappRemindersEnabled = useAgendaWhatsappRemindersEnabled();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateOwnProfileInput>({
    resolver: zodResolver(updateOwnProfileSchema),
    defaultValues: { name, email, phone: phone ?? "", currentPassword: "", newPassword: "" },
  });

  async function onSubmit(data: UpdateOwnProfileInput) {
    const result = await updateOwnProfile(data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Perfil atualizado.");
    await update({ name: data.name, email: data.email });
    router.refresh();
    reset({ name: data.name, email: data.email, phone: data.phone ?? "", currentPassword: "", newPassword: "" });
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset({ name, email, phone: phone ?? "", currentPassword: "", newPassword: "" });
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meu perfil</DialogTitle>
          <DialogDescription>
            Atualize seus próprios dados. Para trocar a senha, informe a senha atual.
          </DialogDescription>
        </DialogHeader>
        <AvatarUploader name={name} currentSrc={avatarSrc} onSave={updateOwnAvatar} />
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="my-profile-name">Nome</Label>
            <Input id="my-profile-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="my-profile-email">E-mail ou usuário</Label>
            <Input id="my-profile-email" type="text" autoCapitalize="none" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="my-profile-phone">{whatsappRemindersEnabled ? "Telefone (WhatsApp para lembretes)" : "Telefone"}</Label>
            <Input id="my-profile-phone" placeholder="27999999999" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">Trocar senha (opcional)</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="my-profile-current-password">Senha atual</Label>
              <Input id="my-profile-current-password" type="password" {...register("currentPassword")} />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="my-profile-new-password">Nova senha</Label>
              <Input
                id="my-profile-new-password"
                type="password"
                placeholder="Deixe em branco para manter"
                {...register("newPassword")}
              />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUser, updateUserAvatar } from "@/features/users/actions";
import { AvatarUploader } from "@/features/users/avatar-uploader";
import { updateUserSchema, type UpdateUserInput } from "@/features/users/schema";
import { useAgendaWhatsappRemindersEnabled } from "@/features/atendimento-automation/agenda-reminders-context";

export function EditUserDialog({
  userId,
  name,
  email,
  phone,
  avatarSrc,
}: {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarSrc: string | null;
}) {
  const whatsappRemindersEnabled = useAgendaWhatsappRemindersEnabled();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name, email, phone: phone ?? "", newPassword: "" },
  });

  async function onSubmit(data: UpdateUserInput) {
    const result = await updateUser(userId, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Usuário atualizado.");
    reset({ ...data, newPassword: "" });
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset({ name, email, phone: phone ?? "", newPassword: "" });
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Editar usuário">
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Altere os dados do usuário. Deixe a senha em branco para não trocá-la.
          </DialogDescription>
        </DialogHeader>
        <AvatarUploader
          name={name}
          currentSrc={avatarSrc}
          onSave={(image) => updateUserAvatar(userId, image)}
        />
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-user-name">Nome</Label>
            <Input id="edit-user-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-user-email">E-mail ou usuário</Label>
            <Input id="edit-user-email" type="text" autoCapitalize="none" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-user-phone">{whatsappRemindersEnabled ? "Telefone (WhatsApp para lembretes)" : "Telefone"}</Label>
            <Input id="edit-user-phone" placeholder="27999999999" {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <Label htmlFor="edit-user-new-password">Nova senha (opcional)</Label>
            <Input id="edit-user-new-password" type="password" placeholder="Deixe em branco para manter" {...register("newPassword")} />
            {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
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

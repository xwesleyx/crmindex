"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Priority } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

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
import { MoneyInput } from "@/components/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOpportunityFromConversation } from "@/features/atendimento/actions";
import {
  createOpportunityFromConversationSchema,
  type CreateOpportunityFromConversationInput,
} from "@/features/atendimento/schema";
import { PRIORITY_LABELS } from "@/lib/priority";
import type { AssignableUser } from "@/features/leads/types";
import type { ConversationDetail } from "@/features/atendimento/types";

type FormRawValues = z.input<typeof createOpportunityFromConversationSchema>;

// Botão + formulário "Criar oportunidade" pelo atendimento (seção 14):
// já vem com contato/empresa/telefone/origem implícitos (a action deriva
// tudo isso do Contact da conversa) — o atendente só completa etapa/valor.
export function CreateOpportunityDialog({
  conversation,
  stages,
  assignableUsers,
}: {
  conversation: ConversationDetail;
  stages: { id: string; name: string }[];
  assignableUsers: AssignableUser[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormRawValues, unknown, CreateOpportunityFromConversationInput>({
    resolver: zodResolver(createOpportunityFromConversationSchema),
    defaultValues: {
      title: `Oportunidade - ${conversation.contact.name}`,
      stageId: stages[0]?.id ?? "",
      priority: conversation.priority,
      estimatedValueCents: 0,
      ownerId: undefined,
    },
  });

  async function onSubmit(data: CreateOpportunityFromConversationInput) {
    const result = await createOpportunityFromConversation(conversation.id, data);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Oportunidade criada.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="w-full" />}>Criar oportunidade</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar oportunidade</DialogTitle>
          <DialogDescription>
            Vinculada a este atendimento — contato, empresa e origem (WhatsApp) já são herdados da
            conversa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-title">Título</Label>
            <Input id="opp-title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Valor estimado</Label>
              <Controller
                control={control}
                name="estimatedValueCents"
                render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Prioridade</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(Priority).map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Etapa inicial</Label>
              <Controller
                control={control}
                name="stageId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Responsável</Label>
              <Controller
                control={control}
                name="ownerId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "unassigned"}
                    onValueChange={(v) => field.onChange(v === "unassigned" ? undefined : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sem responsável</SelectItem>
                      {assignableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar oportunidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

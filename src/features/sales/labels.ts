import type { PaymentMethod, SaleStatus } from "@prisma/client";

import type { BadgeTone } from "@/components/status-badge";

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};

export const SALE_STATUS_TONE: Record<SaleStatus, BadgeTone> = {
  CONFIRMADA: "success",
  CANCELADA: "destructive",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

import { Badge } from "@/components/ui/badge";
import type { Deposit, Order } from "@/db/schema";

export function OrderStatusBadge({ status, expired }: { status: Order["status"]; expired?: boolean }) {
  if (status === "ready" && expired) return <Badge variant="neutral">Vencida</Badge>;
  switch (status) {
    case "ready":
      return <Badge variant="success" dot>Activa</Badge>;
    case "provisioning":
      return <Badge variant="warning" dot="pulse">Generando</Badge>;
    case "refunded":
      return <Badge variant="neutral">Reembolsada</Badge>;
    case "failed":
      return <Badge variant="danger">Fallida</Badge>;
  }
}

export function DepositStatusBadge({ status }: { status: Deposit["status"] }) {
  switch (status) {
    case "completed":
      return <Badge variant="success" dot>Acreditado</Badge>;
    case "pending":
      return <Badge variant="warning" dot="pulse">Pendiente</Badge>;
    case "expired":
      return <Badge variant="neutral">Expirado</Badge>;
    case "cancelled":
      return <Badge variant="neutral">Cancelado</Badge>;
  }
}

export const methodLabel = (m: Deposit["method"]) => (m === "spei" ? "SPEI" : m === "usdt" ? "USDT" : "Manual");

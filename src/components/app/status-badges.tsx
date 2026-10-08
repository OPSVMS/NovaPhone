import { Badge } from "@/components/ui/badge";
import type { Deposit, Order, PhoneNumber } from "@/db/schema";

export function OrderStatusBadge({ status, expired, suspended }: { status: Order["status"]; expired?: boolean; suspended?: boolean }) {
  if (status === "ready" && expired) return <Badge variant="neutral">Vencida</Badge>;
  if (status === "ready" && suspended) return <Badge variant="warning">En pausa</Badge>;
  switch (status) {
    case "ready":
      return <Badge variant="success" dot>Activa</Badge>;
    case "provisioning":
      return <Badge variant="warning" dot="pulse">Generando</Badge>;
    case "refunded":
      return <Badge variant="neutral">Reembolsada</Badge>;
    case "failed":
      return <Badge variant="danger">Fallida</Badge>;
    case "cancelled":
      return <Badge variant="neutral">Cancelada</Badge>;
  }
}

const SMDP_LABELS: Record<string, { label: string; variant: "neutral" | "success" | "warning" | "primary" }> = {
  RELEASED: { label: "Pendiente de instalar", variant: "primary" },
  DOWNLOAD: { label: "Instalando", variant: "warning" },
  INSTALLATION: { label: "Instalando", variant: "warning" },
  ENABLED: { label: "Instalada y encendida", variant: "success" },
  DISABLED: { label: "Instalada, apagada", variant: "neutral" },
  DELETED: { label: "Eliminada del teléfono", variant: "neutral" },
};

/** Estado del perfil en el teléfono del cliente. */
export function InstallStatusBadge({ smdpStatus }: { smdpStatus: string | null }) {
  const s = SMDP_LABELS[smdpStatus ?? "RELEASED"] ?? SMDP_LABELS.RELEASED;
  return <Badge variant={s.variant}>{s.label}</Badge>;
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
    case "returned":
      return <Badge variant="danger">Devuelto</Badge>;
  }
}

export const methodLabel = (m: Deposit["method"]) =>
  m === "spei" ? "SPEI" : m === "usdt" ? "USDT" : m === "card" ? "Tarjeta" : "Manual";

/** Estado del número NovaPhone. */
export function NumberStatusBadge({ graceUntil, autoRenew }: { graceUntil: Date | null; autoRenew: boolean }) {
  if (graceUntil) return <Badge variant="warning" dot="pulse">Pago pendiente</Badge>;
  if (!autoRenew) return <Badge variant="neutral">Sin renovación</Badge>;
  return <Badge variant="success" dot>Activo</Badge>;
}

/** Estado de inventario (admin). */
export function InventoryStatusBadge({ status, cooldownUntil }: { status: PhoneNumber["status"]; cooldownUntil: Date | null }) {
  switch (status) {
    case "available":
      return <Badge variant="success" dot>Disponible</Badge>;
    case "assigned":
      return <Badge variant="primary">Asignado</Badge>;
    case "cooldown":
      return cooldownUntil && cooldownUntil < new Date() ? <Badge variant="success" dot>Disponible</Badge> : <Badge variant="warning">En espera</Badge>;
    case "retired":
      return <Badge variant="neutral">Retirado</Badge>;
  }
}

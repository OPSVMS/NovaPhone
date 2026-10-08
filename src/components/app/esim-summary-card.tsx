import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import type { Order } from "@/db/schema";
import { formatMxn } from "@/lib/pricing";
import { OrderStatusBadge } from "./status-badges";
import { UsageBar } from "./usage-bar";
import { daysLeft, formatBytes, formatDate } from "./format";

/** Compact eSIM card used on the dashboard and in the list. */
export function EsimSummaryCard({ order, now }: { order: Order; now: number }) {
  const left = order.activatedAt ? daysLeft(order.expiresAt, now) : null;
  const expired = order.status === "ready" && left === 0;
  const hasUsage = order.status === "ready" && Number(order.totalBytes) > 0;
  const used = Number(order.usedBytes ?? 0);
  const total = Number(order.totalBytes ?? 0);

  return (
    <Link
      href={`/app/esims/${order.id}`}
      className="group block rounded-card border border-border bg-surface/80 p-5 shadow-card transition-[border-color,background-color,transform] duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2 motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-fg">{order.planName}</p>
          <p className="mt-0.5 text-[13px] text-subtle">
            {formatMxn(order.priceCents)} · {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <OrderStatusBadge status={order.status} expired={expired} />
          <ChevronRight
            aria-hidden
            className="size-4 text-subtle transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </div>
      </div>

      {hasUsage ? (
        <div className="mt-5 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-muted">
              <span className="font-display text-[15px] font-semibold text-fg tabular-nums">
                {formatBytes(Math.max(0, total - used))}
              </span>{" "}
              disponibles
            </span>
            <span className="text-subtle tabular-nums">de {formatBytes(total)}</span>
          </div>
          <UsageBar used={used} total={total} />
          {order.autoTopupPlanId ? <p className="text-[12px] text-lavender">Auto-recarga activa</p> : null}
          {left !== null ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-subtle">
              <CalendarClock aria-hidden className="size-3.5" />
              {expired ? "Vencida" : `${left} ${left === 1 ? "día restante" : "días restantes"}`}
            </p>
          ) : null}
        </div>
      ) : order.status === "ready" ? (
        <p className="mt-4 text-[13px] text-muted">Lista para instalar. Toca para ver tu QR.</p>
      ) : order.status === "provisioning" ? (
        <p className="mt-4 text-[13px] text-muted">Estamos generando tu eSIM. Toma menos de un minuto.</p>
      ) : (
        <p className="mt-4 text-[13px] text-muted">No se pudo generar. Tu saldo fue devuelto.</p>
      )}
    </Link>
  );
}

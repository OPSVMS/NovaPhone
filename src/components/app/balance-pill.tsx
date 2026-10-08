import Link from "next/link";
import { Plus } from "lucide-react";
import { formatMxn } from "@/lib/pricing";

/** Always-visible balance with a quick "+ Agregar" (→ /app/fondos). */
export function BalancePill({ balanceCents }: { balanceCents: number }) {
  return (
    <div className="flex h-10 items-center rounded-full border border-border bg-surface/80 p-1 pl-3.5 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
      <Link
        href="/app/movimientos"
        className="flex flex-col justify-center pr-2.5 leading-none"
        aria-label={`Saldo disponible: ${formatMxn(balanceCents)}. Ver movimientos`}
      >
        <span className="font-display text-[15px] font-semibold text-fg tabular-nums">{formatMxn(balanceCents)}</span>
      </Link>
      <Link
        href="/app/fondos"
        className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-2.5 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.2)] transition-colors duration-200 hover:bg-primary-hover"
      >
        <Plus aria-hidden className="size-3.5" />
        <span>Agregar</span>
      </Link>
    </div>
  );
}

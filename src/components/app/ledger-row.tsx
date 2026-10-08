import clsx from "clsx";
import { ArrowDownLeft, CardSim, SlidersHorizontal, Undo2 } from "lucide-react";
import { formatMxn } from "@/lib/pricing";
import { formatDate, formatDateTime } from "./format";

type Entry = {
  id: string;
  amountCents: number;
  kind: "deposit" | "purchase" | "refund" | "adjustment";
  description: string;
  balanceAfterCents: number;
  createdAt: Date;
};

const KIND = {
  deposit: { icon: ArrowDownLeft, label: "Depósito", tone: "text-success bg-success/10 border-success/20" },
  purchase: { icon: CardSim, label: "Compra", tone: "text-lavender bg-primary/10 border-lavender/20" },
  refund: { icon: Undo2, label: "Reembolso", tone: "text-info bg-info/10 border-info/20" },
  adjustment: { icon: SlidersHorizontal, label: "Ajuste", tone: "text-muted bg-white/[0.04] border-border" },
} as const;

export function LedgerRow({
  entry,
  showBalance = true,
  timeOnly = false,
}: {
  entry: Entry;
  showBalance?: boolean;
  timeOnly?: boolean;
}) {
  const k = KIND[entry.kind] ?? KIND.adjustment;
  const Icon = k.icon;
  const positive = entry.amountCents >= 0;
  return (
    <li className="flex items-center gap-3 py-3.5">
      <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-xl border", k.tone)}>
        <Icon aria-hidden className="size-[18px]" />
        <span className="sr-only">{k.label}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-fg">{entry.description}</span>
        <span className="text-[13px] text-subtle">{timeOnly ? formatDate(entry.createdAt, { hour: "2-digit", minute: "2-digit" }) : formatDateTime(entry.createdAt)}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={clsx(
            "font-display text-[15px] font-semibold tabular-nums",
            positive ? "text-success" : "text-fg",
          )}
        >
          {positive ? "+" : "−"}
          {formatMxn(Math.abs(entry.amountCents))}
        </span>
        {showBalance ? (
          <span className="text-[12px] text-subtle tabular-nums">
            Saldo {formatMxn(entry.balanceAfterCents)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

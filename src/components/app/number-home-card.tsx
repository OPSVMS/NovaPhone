import Link from "next/link";
import { ArrowRight, ChevronRight, MessageSquareText } from "lucide-react";
import type { PhoneNumber, SmsMessage } from "@/db/schema";
import { CopyButton } from "@/components/ui/copy-button";
import { NumberStatusBadge } from "./status-badges";
import { CodeChip } from "./sms-inbox";
import { extractCode, formatDate, formatPhone, relativeTime } from "./format";

const longDate = (d: Date | null) => formatDate(d, { day: "numeric", month: "long" });

/** Tarjeta compacta "Tu número" para el inicio: número, estado y último mensaje. */
export function NumberHomeCard({
  number,
  latest,
  total,
  now,
}: {
  number: PhoneNumber;
  latest: SmsMessage | undefined;
  total: number;
  now: number;
}) {
  const code = latest ? extractCode(latest.body) : null;
  const status = number.graceUntil
    ? `Pago pendiente · se libera el ${longDate(number.graceUntil)}`
    : number.autoRenew
      ? `Renueva el ${longDate(number.renewsAt)}`
      : `Activo hasta el ${longDate(number.renewsAt)}`;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface/80 p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] text-muted">Reino Unido</span>
          <div className="flex items-center gap-1.5">
            <p className="font-display text-xl font-semibold tracking-tight text-fg tabular-nums sm:text-2xl">
              {formatPhone(number.e164)}
            </p>
            <CopyButton value={number.e164} ariaLabel="Copiar número" variant="ghost" size="icon-sm" />
          </div>
          <p className="text-[13px] text-subtle">{status}</p>
        </div>
        <NumberStatusBadge graceUntil={number.graceUntil} autoRenew={number.autoRenew} />
      </div>

      <div className="hairline" />

      {latest ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-muted">
              Último mensaje · <span className="text-fg">{formatPhone(latest.fromNumber)}</span>
            </span>
            <time dateTime={latest.receivedAt.toISOString()} className="shrink-0 text-subtle tabular-nums">
              {relativeTime(latest.receivedAt, now)}
            </time>
          </div>
          {code ? <CodeChip code={code} size="md" /> : <p className="line-clamp-2 text-sm leading-relaxed text-muted">{latest.body}</p>}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Aún no recibes mensajes. Úsalo al registrarte en WhatsApp o Telegram y el código llegará aquí.
        </p>
      )}

      <Link
        href="/app/numero"
        className="inline-flex w-fit items-center gap-1 text-sm text-lavender hover:text-lavender-soft"
      >
        {total > 0 ? `Ver mensajes (${total})` : "Ver cómo usarlo"} <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

/** Promo discreta para quien aún no tiene número. */
export function NumberPromoCard({ priceLabel }: { priceLabel: string }) {
  return (
    <Link
      href="/app/numero"
      className="group flex items-center gap-3 rounded-card border border-dashed border-border-strong px-4 py-3.5 transition-colors duration-200 hover:border-lavender/30 hover:bg-surface-2/60"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-control border border-border bg-surface-2 text-lavender">
        <MessageSquareText aria-hidden className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium text-fg">Agrega un número para recibir códigos de WhatsApp</span>
        <span className="text-[13px] text-subtle tabular-nums">Número del Reino Unido (+44) · {priceLabel}/mes</span>
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
      />
    </Link>
  );
}

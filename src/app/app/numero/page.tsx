import type { Metadata } from "next";
import { CalendarClock, Check, Info, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/session";
import { canSellNumber, getUserNumber, NUMBER_PRICE_MXN } from "@/lib/numbers";
import { getUserOrders } from "@/lib/orders";
import { formatMxn } from "@/lib/pricing";
import type { Order } from "@/db/schema";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { FadeIn } from "@/components/motion/fade-in";
import { Aurora } from "@/components/motion/aurora";
import { PageHeader } from "@/components/app/page-header";
import { NumberStatusBadge } from "@/components/app/status-badges";
import { NumberBuy, NumberSettings, type EsimOption } from "@/components/app/number-panels";
import { CommsHub } from "@/components/app/sms-inbox";
import { getCommsHistory } from "@/app/api/numero/history";
import { formatDate, formatPhone, topUpAmountMxn } from "@/components/app/format";

export const metadata: Metadata = { title: "Mi número" };

const esimOption = (o: Order): EsimOption => ({
  id: o.id,
  label: `${o.planName}${o.iccid ? ` · …${o.iccid.slice(-4)}` : ""}`,
});

const longDate = (d: Date | null) => formatDate(d, { day: "numeric", month: "long" });

export default async function NumberPage() {
  const user = await requireUser();
  const [number, orders] = await Promise.all([getUserNumber(user.id), getUserOrders(user.id)]);

  if (!number) {
    const priceCents = NUMBER_PRICE_MXN() * 100;
    const available = (await canSellNumber()) ? 1 : 0;
    const esims = orders.filter((o) => o.status === "ready").map(esimOption);
    return <NoNumber priceCents={priceCents} balanceCents={user.balanceCents} esims={esims} soldOut={available === 0} />;
  }

  const history = await getCommsHistory(number.id, user.id);
  const priceCents = number.monthlyPriceCents ?? NUMBER_PRICE_MXN() * 100;
  const esims = orders.filter((o) => o.status === "ready" || o.id === number.orderId).map(esimOption);
  const linked = orders.find((o) => o.id === number.orderId);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Mi número" description="Tus mensajes y llamadas en un solo lugar." />

      {number.graceUntil ? (
        <Alert
          variant="warning"
          title="No pudimos renovar tu número"
          action={
            <Button href={`/app/fondos?monto=${topUpAmountMxn(priceCents - user.balanceCents)}`} size="sm">
              Agregar saldo
            </Button>
          }
        >
          Agrega al menos {formatMxn(priceCents)} antes del {longDate(number.graceUntil)} para conservarlo. Lo renovamos en
          cuanto llegue tu saldo; si no, el número se libera.
        </Alert>
      ) : null}

      <FadeIn immediate>
        <section
          aria-label="Tu número"
          className="relative isolate overflow-hidden rounded-panel border border-border bg-surface/80 p-5 shadow-card sm:p-8"
        >
          <Aurora variant="spot" noise={false} />
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">Tu número NovaPhone · Reino Unido</span>
              <NumberStatusBadge graceUntil={number.graceUntil} autoRenew={number.autoRenew} />
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-[2rem] font-semibold leading-none tracking-tight text-fg tabular-nums sm:text-5xl">
                {formatPhone(number.e164)}
              </p>
              <CopyButton value={number.e164} label="Copiar número" ariaLabel="Copiar número" variant="secondary" className="w-full sm:w-auto" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-subtle">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock aria-hidden className="size-3.5" />
                {number.graceUntil
                  ? `Pago pendiente · se libera el ${longDate(number.graceUntil)}`
                  : number.autoRenew
                    ? `Se renueva el ${longDate(number.renewsAt)} · ${formatMxn(priceCents)}`
                    : `Activo hasta el ${longDate(number.renewsAt)}`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail aria-hidden className="size-3.5" /> Copia de cada SMS a tu correo
              </span>
              {linked ? <span>Ligado a {linked.planName}</span> : null}
            </div>
          </div>
        </section>
      </FadeIn>

      <CommsHub e164={number.e164} initial={history} initialNow={new Date().getTime()} />

      <NumberSettings
        autoRenew={number.autoRenew}
        renewsLabel={longDate(number.renewsAt)}
        priceLabel={formatMxn(priceCents)}
        esims={esims}
        linkedOrderId={number.orderId}
      />

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-subtle">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Algunas apps o bancos pueden no aceptar números virtuales. Si el código no llega, pide que lo reenvíen por SMS.
      </p>
    </div>
  );
}

function NoNumber({
  priceCents,
  balanceCents,
  esims,
  soldOut,
}: {
  priceCents: number;
  balanceCents: number;
  esims: EsimOption[];
  soldOut: boolean;
}) {
  const perks = [
    "Recibe SMS y códigos al instante en tu panel y en tu correo.",
    "Se renueva cada 30 días automáticamente con tu saldo.",
    "Cancela cuando quieras, sin plazos forzosos.",
  ];
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Mi número" />

      <FadeIn immediate>
        <section className="relative isolate overflow-hidden rounded-panel border border-border bg-surface/80 p-5 shadow-card sm:p-8">
          <Aurora variant="spot" noise={false} />
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-start">
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-lavender">
                  <MessageSquareText aria-hidden className="size-5" />
                </span>
                <Badge variant="accent">Nuevo</Badge>
              </div>
              <div className="flex flex-col gap-2.5">
                <h2 className="text-2xl font-semibold text-fg sm:text-3xl">Número NovaPhone</h2>
                <p className="text-[15px] leading-relaxed text-muted">
                  Un número móvil del Reino Unido (+44) para recibir SMS y códigos de verificación (WhatsApp, Telegram,
                  apps). Llega a tu panel y a tu correo.
                </p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {perks.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-5 rounded-card border border-border bg-bg/40 p-5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-semibold tracking-tight text-fg tabular-nums">
                  {formatMxn(priceCents)}
                </span>
                <span className="text-sm text-muted">/mes</span>
              </div>
              <p className="-mt-3 text-[13px] text-subtle">Se paga con tu saldo NovaPhone.</p>
              <NumberBuy
                priceCents={priceCents}
                balanceCents={balanceCents}
                esims={esims}
                soldOut={soldOut}
                topUpMxn={topUpAmountMxn(priceCents - balanceCents)}
              />
            </div>
          </div>
        </section>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { t: "Obtén tu número", d: "Se asigna al instante y queda en tu panel." },
          { t: "Regístrate en tu app", d: "Elige Reino Unido (+44) y escribe tu número." },
          { t: "Copia el código", d: "El SMS aparece aquí en segundos y en tu correo." },
        ].map((s, i) => (
          <Card key={s.t} className="flex flex-col gap-2 p-5">
            <span className="font-display text-[13px] font-semibold text-lavender tabular-nums">0{i + 1}</span>
            <p className="font-medium text-fg">{s.t}</p>
            <p className="text-[13px] leading-relaxed text-muted">{s.d}</p>
          </Card>
        ))}
      </div>

      <Alert variant="info" icon={<ShieldCheck aria-hidden />} title="Antes de comprar">
        Por ahora el número recibe SMS y códigos; las llamadas llegan muy pronto. Algunas apps o bancos pueden no aceptar
        números virtuales.
      </Alert>
    </div>
  );
}

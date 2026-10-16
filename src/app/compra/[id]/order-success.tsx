"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { motion } from "motion/react";
import { CalendarClock, Check, CircleHelp, CircleX, Clock, Mail, MessageSquareText, QrCode, Smartphone, UserRound } from "lucide-react";
import type { OrderForSuccess } from "@/lib/checkout";
import { PurchaseTracker } from "@/components/analytics/purchase-tracker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CopyField, InfoRow } from "@/components/app/copy-field";
import { InstallGuide } from "@/components/app/install-guide";

const POLL_MS = [1500, 2000, 2500, 3000, 4000, 5000];
const fmtMxn = (pesos: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: Number.isInteger(pesos) ? 0 : 2 }).format(pesos);

/** Cuerpo de la página de éxito: consulta /api/orders/{id}?t= hasta que la eSIM esté lista. */
export function OrderSuccess({ initial, token }: { initial: OrderForSuccess; token: string }) {
  const [order, setOrder] = useState(initial);
  const [polls, setPolls] = useState(0);
  const waiting = order.status === "pending" || order.status === "provisioning";
  const orderId = order.id;

  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const delay = polls > 60 ? 10_000 : POLL_MS[Math.min(polls, POLL_MS.length - 1)];
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (alive && res.ok) setOrder((await res.json()) as OrderForSuccess);
      } catch {
        /* red: se reintenta */
      }
      if (alive) setPolls((n) => n + 1);
    }, delay);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [orderId, polls, waiting, token]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8" data-testid="order-success" data-status={order.status}>
      {order.purchase ? (
        <PurchaseTracker
          order={{
            id: order.purchase.transactionId,
            valueMxn: order.purchase.value,
            email: order.email,
            coupon: order.purchase.coupon,
            items: order.purchase.items.map((i) => ({ ...i, category: "esim" })),
          }}
        />
      ) : null}

      {order.status === "ready" && order.esim ? (
        <Ready order={order} esim={order.esim} />
      ) : order.status === "pending" || order.status === "provisioning" ? (
        <Preparing stage={order.status === "pending" ? 0 : 1} slow={polls > 30} />
      ) : order.status === "expired" ? (
        <StatusCard icon={<Clock className="size-6" />} tone="neutral" title="La página de pago expiró" body="No se hizo ningún cargo. Puedes volver a intentarlo cuando quieras.">
          <Button href={order.links.buyAgain} size="lg" className="w-full sm:w-auto">
            Volver a intentar
          </Button>
        </StatusCard>
      ) : (
        <StatusCard
          icon={<CircleX className="size-6" />}
          tone="danger"
          title="No pudimos generar tu eSIM"
          body={
            order.status === "refunded"
              ? `Te devolvimos ${fmtMxn(order.paidMxn ?? order.priceMxn)} a tu tarjeta. Puede tardar de 5 a 10 días hábiles en verse en tu estado de cuenta.`
              : "Hubo un problema con el proveedor. Nuestro equipo ya lo está revisando y te escribirá por correo; si no se resuelve, te devolvemos tu dinero."
          }
        >
          <Button href={order.links.buyAgain} size="lg" variant="secondary" className="w-full sm:w-auto">
            Ver planes
          </Button>
        </StatusCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {order.status === "ready" && order.esim ? (
            <>
              <Card id="manual" className="scroll-mt-24">
                <CardHeader>
                  <CardTitle>Instalación manual</CardTitle>
                  <CardDescription>Si no puedes escanear el QR ni usar el botón, copia estos datos al agregar la eSIM.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {order.esim.smdpAddress ? <CopyField label="Dirección SM-DP+" value={order.esim.smdpAddress} copyLabel="Copiar dirección SM-DP+" /> : null}
                  {order.esim.matchingId ? <CopyField label="Código de activación" value={order.esim.matchingId} copyLabel="Copiar código de activación" /> : null}
                  <CopyField label="Código completo (LPA)" value={order.esim.activationCode} hint="Algunos Android lo piden completo." copyLabel="Copiar código LPA" />
                  <div className="mt-1 divide-y divide-border">
                    {order.esim.apn ? (
                      <InfoRow label="APN">
                        <span className="font-mono">{order.esim.apn}</span>
                      </InfoRow>
                    ) : null}
                    {order.esim.iccid ? (
                      <InfoRow label="ICCID">
                        <span className="font-mono text-[13px] tabular-nums">{order.esim.iccid}</span>
                      </InfoRow>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Cómo instalarla</CardTitle>
                  <CardDescription>Toma menos de 2 minutos. Necesitas conexión a internet (Wi‑Fi).</CardDescription>
                </CardHeader>
                <CardContent>
                  <InstallGuide apn={order.esim.apn} />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="font-display text-lg font-semibold text-fg">Resumen</h2>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-fg">{order.plan.name}</span>
              <span className="text-[13px] text-muted">Red Telcel 5G · México</span>
            </div>
            <dl className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Pedido</dt>
                <dd className="font-mono text-[13px] text-fg">#{order.id.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Correo</dt>
                <dd className="min-w-0 truncate text-fg" data-testid="order-email">
                  {order.email || "—"}
                </dd>
              </div>
              {order.promotionCode ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Código</dt>
                  <dd className="font-mono text-[13px] text-fg">{order.promotionCode}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{order.paidMxn !== null ? "Pagaste" : "Total"}</dt>
                <dd className="font-semibold text-fg tabular-nums" data-testid="total-paid">
                  {fmtMxn(order.paidMxn ?? order.priceMxn)}
                </dd>
              </div>
            </dl>
          </Card>

          {order.number ? (
            <Card className="flex flex-col gap-3 p-5" data-testid="order-number">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
                <MessageSquareText aria-hidden className="size-5 text-lavender" /> Tu número para códigos
              </h2>
              <p className="font-mono text-xl font-semibold tracking-wide text-fg tabular-nums" data-testid="order-number-e164">
                {order.number.e164}
              </p>
              <p className="text-sm leading-relaxed text-muted">
                Tu número para códigos: {order.number.e164}; los mensajes llegan a tu panel. Úsalo para recibir SMS de verificación durante 30 días.
              </p>
              <Link href="/app/numero" className="text-sm font-medium text-lavender underline-offset-4 hover:underline">
                Ver mensajes en mi panel
              </Link>
            </Card>
          ) : order.numberRefund ? (
            <p className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted" data-testid="order-number-refund">
              Por ahora no había números para recibir códigos.{" "}
              {order.numberRefund.to === "card"
                ? `Te devolvimos ${fmtMxn(order.numberRefund.amountMxn)} a tu tarjeta.`
                : `Te dejamos ${fmtMxn(order.numberRefund.amountMxn)} como saldo en tu cuenta.`}
            </p>
          ) : null}

          {order.email ? (
            <Card className="flex flex-col gap-3 p-5" data-testid="account-box">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
                <UserRound aria-hidden className="size-5 text-lavender" /> Tu cuenta NovaPhone
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                {order.newAccount
                  ? `Creamos tu cuenta con ${order.email}. Ahí ves tu consumo y recargas la misma eSIM. Para entrar, crea tu contraseña con un código que te mandamos al correo.`
                  : `Esta eSIM ya está en tu cuenta (${order.email}). Ahí ves tu consumo y la recargas.`}
              </p>
              {order.newAccount ? (
                <Link href={order.links.setPassword} className={buttonVariants({ variant: "secondary", fullWidth: true })} data-testid="set-password-link">
                  Crear mi contraseña
                </Link>
              ) : null}
              <Link
                href={order.links.login}
                className={order.newAccount ? "text-center text-sm font-medium text-lavender underline-offset-4 hover:underline" : buttonVariants({ variant: "secondary", fullWidth: true })}
                data-testid="login-link"
              >
                Ya tengo contraseña, entrar
              </Link>
            </Card>
          ) : null}

          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-subtle">
            <CircleHelp aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            ¿Necesitas ayuda para instalarla? Escríbenos a hola@novaphone.lat con tu número de pedido.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Ready({ order, esim }: { order: OrderForSuccess; esim: NonNullable<OrderForSuccess["esim"]> }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Instala tu eSIM"
      className="relative isolate overflow-hidden rounded-panel border border-border bg-surface/80 p-5 shadow-card sm:p-8"
      data-testid="esim-ready"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="flex size-12 items-center justify-center rounded-full border border-success/25 bg-success/10 text-success">
            <Check aria-hidden className="size-6" strokeWidth={2.5} />
          </span>
          <h1 className="text-2xl font-semibold text-fg sm:text-3xl">¡Listo! Tu eSIM ya es tuya</h1>
          <p className="flex items-start gap-2 text-[15px] leading-relaxed text-muted" data-testid="email-notice">
            <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" />
            <span>
              {order.emailSent ? "También te la enviamos" : "También te la enviaremos en unos segundos"}
              {order.email ? (
                <>
                  {" "}
                  a <span className="text-fg">{order.email}</span>
                </>
              ) : null}{" "}
              con el QR y estas instrucciones.
            </span>
          </p>
        </div>

        <div className="grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
          <div className="mx-auto flex flex-col items-center gap-2.5">
            <div className="rounded-[24px] bg-white p-3 shadow-glow">
              {/* eslint-disable-next-line @next/next/no-img-element -- PNG firmado, no optimizable */}
              <img src={esim.qrUrl} alt="Código QR para instalar tu eSIM" width={224} height={224} className="size-52 rounded-xl sm:size-56" data-testid="esim-qr" />
            </div>
            <p className="flex items-center gap-1.5 text-center text-[13px] text-subtle">
              <QrCode aria-hidden className="size-3.5" /> Escanéalo desde otro dispositivo
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <a href={esim.iosInstallUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg", fullWidth: true })} data-testid="install-ios">
              <Smartphone aria-hidden /> Instalar en iPhone
            </a>
            <a href={esim.androidInstallUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg", variant: "secondary", fullWidth: true })} data-testid="install-android">
              <Smartphone aria-hidden /> Instalar en Android
            </a>
            <a href="#manual" className="text-center text-sm font-medium text-lavender underline-offset-4 hover:underline">
              Instalar manualmente
            </a>
            <p className="text-[13px] leading-relaxed text-subtle">Los botones funcionan abiertos desde el mismo teléfono (iOS 17.4+ o Android compatible).</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-lavender/20 bg-primary/[0.07] px-4 py-3.5" data-testid="activate-when-ready">
          <CalendarClock aria-hidden className="mt-0.5 size-[18px] shrink-0 text-lavender" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium text-fg">Actívala cuando estés listo</p>
            <p className="leading-relaxed text-muted">
              Puedes instalarla hoy: los {order.plan.days ? `${order.plan.days} días` : "días"} de tu plan empiezan a contar hasta que te conectas por primera vez.
              Al terminar, enciende <span className="text-fg">Roaming de datos</span> en la eSIM. Una eSIM solo se instala una vez: no la borres.
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Preparing({ stage, slow }: { stage: 0 | 1; slow: boolean }) {
  const steps = ["Pago confirmado", "Generando tu eSIM", "Lista para instalar"];
  return (
    <section className="flex flex-col gap-6 rounded-panel border border-border bg-surface/80 p-6 shadow-card sm:p-8" data-testid="order-preparing" aria-live="polite">
      <div className="flex items-center gap-4">
        <span className="relative grid size-14 shrink-0 place-items-center">
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-lavender/20 motion-reduce:animate-none" />
          <span className="relative grid size-14 place-items-center rounded-full border border-border-strong bg-surface-2 text-lavender">
            <Spinner size={24} label={null} />
          </span>
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-fg sm:text-2xl">{stage === 0 ? "Confirmando tu pago…" : "Generando tu eSIM…"}</h1>
          <p className="text-[15px] text-muted">
            {slow
              ? "Está tardando un poco más de lo normal. Puedes cerrar esta pantalla: te enviaremos tu eSIM por correo en cuanto esté lista."
              : "Suele tardar menos de un minuto. No cierres esta pantalla; también te la enviaremos por correo."}
          </p>
        </div>
      </div>
      <ol className="grid gap-2.5 sm:grid-cols-3">
        {steps.map((s, i) => {
          const done = i < stage;
          const current = i === stage;
          return (
            <li
              key={s}
              className={clsx(
                "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium",
                done ? "border-success/25 bg-success/[0.06] text-fg" : current ? "border-lavender/30 bg-primary/[0.08] text-fg" : "border-border text-subtle",
              )}
            >
              {done ? <Check aria-hidden className="size-4 text-success" /> : current ? <Spinner size={14} label={null} /> : <span className="size-4" />}
              {s}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StatusCard({ icon, title, body, tone, children }: { icon: ReactNode; title: string; body: string; tone: "danger" | "neutral"; children?: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-panel border border-border bg-surface/80 p-6 shadow-card sm:p-8">
      <span
        className={clsx(
          "flex size-12 items-center justify-center rounded-2xl border",
          tone === "danger" ? "border-danger/25 bg-danger/10 text-danger" : "border-border bg-surface-2 text-muted",
        )}
      >
        {icon}
      </span>
      <h1 className="text-xl font-semibold text-fg sm:text-2xl">{title}</h1>
      <p className="max-w-prose text-[15px] leading-relaxed text-muted">{body}</p>
      {children}
    </section>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, ChevronRight, CircleHelp, Gauge, MessageSquareText, QrCode, Smartphone, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserOrder, appleInstallUrl } from "@/lib/orders";
import { getTopupOptions, syncUsage, type TopupOption } from "@/lib/topups";
import { TopupPanel } from "@/components/app/topup-panel";
import { EsimManage } from "@/components/app/esim-manage";
import { canCancel } from "@/lib/lifecycle";
import { getOrderTopups } from "@/lib/topups";
import { getUserNumber } from "@/lib/numbers";
import { UUID_RE } from "@/lib/queries";
import { formatMxn } from "@/lib/pricing";
import { Alert } from "@/components/ui/alert";
import { CopyButton } from "@/components/ui/copy-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { Aurora } from "@/components/motion/aurora";
import { PageHeader } from "@/components/app/page-header";
import { OrderStatusBadge } from "@/components/app/status-badges";
import { OrderProvisioning } from "@/components/app/order-provisioning";
import { InstallGuide } from "@/components/app/install-guide";
import { CopyField, InfoRow } from "@/components/app/copy-field";
import { UsageBar } from "@/components/app/usage-bar";
import { daysLeft, formatBytes, formatDate, formatDateTime, formatPhone, splitActivationCode } from "@/components/app/format";

export const metadata: Metadata = { title: "Tu eSIM" };

const STALE_MS = 10 * 60_000;

export default async function EsimPage({ params }: PageProps<"/app/esims/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const user = await requireUser();
  let order = await getUserOrder(user.id, id);
  if (!order) notFound();

  const now = new Date().getTime();
  // Refresh usage for ready eSIMs at most every 10 minutes.
  if (order.status === "ready" && (!order.usageSyncedAt || now - new Date(order.usageSyncedAt).getTime() > STALE_MS)) {
    order = await syncUsage(order).catch(() => order!);
  }

  // Antes de la primera conexión el proveedor reporta el plazo para activarla, no la vigencia del plan.
  const activated = !!order.activatedAt;
  const left = activated ? daysLeft(order.expiresAt, now) : null;
  const expired = order.status === "ready" && left === 0;
  const back = { href: "/app/esims", label: "Mis eSIM" };

  if (order.status === "provisioning") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={order.planName} />
        <section className="relative isolate overflow-hidden rounded-panel border border-border bg-surface/60">
          <Aurora variant="spot" noise={false} />
          <OrderProvisioning orderId={order.id} />
        </section>
      </div>
    );
  }

  if (order.status === "refunded" || order.status === "failed" || order.status === "cancelled") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={order.planName} action={<OrderStatusBadge status={order.status} />} />
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col items-start gap-5">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender">
              <Undo2 aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-fg">{order.status === "cancelled" ? "eSIM cancelada" : "No pudimos generar esta eSIM"}</h2>
              <p className="max-w-prose text-[15px] leading-relaxed text-muted">
                {order.status === "cancelled"
                  ? "Cancelaste esta eSIM antes de instalarla y el saldo ya está de vuelta en tu cuenta."
                  : order.status === "refunded"
                  ? `Tu saldo de ${formatMxn(order.priceCents)} ya fue devuelto a tu cuenta. Puedes intentarlo de nuevo cuando quieras; no se te cobró nada.`
                  : "Hubo un problema con el proveedor. Si se descontó saldo, nuestro equipo lo revisará y te lo devolverá."}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <Button href="/app/comprar" className="w-full sm:w-auto">
                Intentar de nuevo
              </Button>
              <Button href="/app/movimientos" variant="secondary" className="w-full sm:w-auto">
                Ver movimientos
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Ready
  const ac = order.activationCode ?? "";
  const { smdp, code } = splitActivationCode(ac);
  const total = Number(order.totalBytes ?? 0);
  const used = Number(order.usedBytes ?? 0);
  const [topupOptions, topups, phone] = await Promise.all([
    expired ? Promise.resolve([] as TopupOption[]) : getTopupOptions(order).catch(() => [] as TopupOption[]),
    getOrderTopups(order.id),
    getUserNumber(user.id).catch(() => undefined),
  ]);
  const linkedPhone = phone && phone.orderId === order.id ? phone : null;
  const refundCents = order.priceCents + topups.filter((t) => t.status === "applied").reduce((a, t) => a + t.priceCents, 0);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        back={back}
        title={order.planName}
        description={`Comprada el ${formatDate(order.createdAt, { day: "numeric", month: "long", year: "numeric" })}`}
        action={<OrderStatusBadge status={order.status} expired={expired} suspended={order.suspended} />}
      />

      {order.suspended ? (
        <Alert variant="warning" title="Tu eSIM está en pausa">
          No se conectará a internet hasta que la reactives desde “Administrar”.
        </Alert>
      ) : null}

      {expired ? (
        <Alert
          variant="info"
          title="Este plan ya venció"
          action={
            <Button href="/app/comprar" size="sm">
              Comprar otro
            </Button>
          }
        >
          Puedes borrar la eSIM de tu teléfono y comprar un plan nuevo.
        </Alert>
      ) : null}

      {/* Hero: QR + install */}
      <FadeIn immediate>
        <section
          aria-label="Instala tu eSIM"
          className="relative isolate overflow-hidden rounded-panel border border-border bg-surface/80 p-5 shadow-card sm:p-8"
        >
          <Aurora variant="subtle" noise={false} />
          <div className="grid items-center gap-8 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="mx-auto flex flex-col items-center gap-3">
              <div className="rounded-[24px] bg-white p-3 shadow-glow">
                {ac ? (
                  // eslint-disable-next-line @next/next/no-img-element -- session-authenticated PNG
                  <img
                    src={`/api/qr/${order.id}`}
                    alt="Código QR para instalar tu eSIM"
                    width={224}
                    height={224}
                    className="size-52 rounded-xl sm:size-56"
                  />
                ) : (
                  <div className="flex size-52 items-center justify-center text-bg sm:size-56">
                    <QrCode aria-hidden className="size-10 opacity-40" />
                  </div>
                )}
              </div>
              <p className="text-center text-[13px] text-subtle">Escanéalo desde otro dispositivo</p>
            </div>
            <div className="flex flex-col gap-5 text-center sm:text-left">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-fg">Tu eSIM está lista</h2>
                <p className="text-[15px] leading-relaxed text-muted">
                  Instálala con Wi‑Fi y, al terminar, activa{" "}
                  <span className="text-fg">Roaming de datos</span> en la eSIM para conectarte a la red Telcel.
                </p>
              </div>
              {ac ? (
                <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                  <a
                    href={appleInstallUrl(ac)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
                  >
                    <Smartphone aria-hidden /> Instalar en iPhone
                  </a>
                  <a href="#manual" className={buttonVariants({ size: "lg", variant: "secondary", className: "w-full sm:w-auto" })}>
                    Instalar manualmente
                  </a>
                </div>
              ) : null}
              <p className="text-[13px] text-subtle">“Instalar en iPhone” requiere iOS 17.4 o posterior y abrirlo desde el iPhone.</p>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Usage */}
      {total > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge aria-hidden className="size-4 text-lavender" /> Consumo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted">
                <span className="font-display text-2xl font-semibold text-fg tabular-nums">
                  {formatBytes(Math.max(0, total - used))}
                </span>{" "}
                disponibles
              </p>
              <p className="text-sm text-subtle tabular-nums">
                {formatBytes(used)} de {formatBytes(total)}
              </p>
            </div>
            <UsageBar used={used} total={total} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-subtle">
              {activated && order.expiresAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock aria-hidden className="size-3.5" />
                  {expired ? "Venció" : "Vence"} el {formatDateTime(order.expiresAt)}
                  {!expired && left !== null ? ` · ${left} ${left === 1 ? "día" : "días"}` : ""}
                </span>
              ) : (
                <span>Los días de tu plan empiezan a contar cuando te conectas por primera vez.</span>
              )}
              <span>Actualizado {formatDateTime(order.usageSyncedAt ?? order.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {linkedPhone ? (
        <Link
          href="/app/numero"
          className="group flex min-h-16 items-center gap-3 rounded-card border border-border bg-surface px-5 py-3.5 shadow-card transition-colors duration-200 hover:border-border-strong hover:bg-surface-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-lavender">
            <MessageSquareText aria-hidden className="size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] text-muted">Número ligado</span>
            <span className="truncate font-display font-semibold text-fg tabular-nums">{formatPhone(linkedPhone.e164)}</span>
          </span>
          <span className="hidden text-[13px] text-subtle sm:inline">Ver mensajes</span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : !phone && !expired ? (
        <Link
          href="/app/numero"
          className="group flex min-h-14 items-center gap-3 rounded-card border border-dashed border-border-strong px-5 py-3 text-sm text-muted transition-colors duration-200 hover:border-lavender/40 hover:text-fg"
        >
          <MessageSquareText aria-hidden className="size-4 shrink-0 text-lavender" />
          <span className="flex-1">
            <span className="font-medium text-fg">Agrega un número para WhatsApp</span>
            <span className="hidden sm:inline"> · recibe SMS y códigos de verificación</span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      ) : null}

      {topupOptions.length ? (
        <TopupPanel orderId={order.id} options={topupOptions} autoPlanId={order.autoTopupPlanId} balanceCents={user.balanceCents} />
      ) : null}

      {!expired ? (
        <EsimManage
          orderId={order.id}
          smdpStatus={order.smdpStatus}
          suspended={order.suspended}
          canCancel={canCancel(order)}
          refundCents={refundCents}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Manual install */}
        <Card id="manual" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Instalación manual</CardTitle>
            <CardDescription>Si no puedes escanear el QR, copia estos datos al agregar la eSIM.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {smdp ? <CopyField label="Dirección SM-DP+" value={smdp} copyLabel="Copiar dirección SM-DP+" /> : null}
            {code ? <CopyField label="Código de activación" value={code} copyLabel="Copiar código de activación" /> : null}
            {ac ? (
              <CopyField
                label="Código completo (LPA)"
                value={ac}
                hint="Algunos Android lo piden completo."
                copyLabel="Copiar código LPA"
              />
            ) : null}
            <div className="mt-1 divide-y divide-border">
              {order.apn ? (
                <InfoRow label="APN">
                  <span className="font-mono">{order.apn}</span>
                </InfoRow>
              ) : null}
              {order.iccid ? (
                <div className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="text-muted">ICCID</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-[13px] text-fg tabular-nums">{order.iccid}</span>
                    <CopyButton value={order.iccid} ariaLabel="Copiar ICCID" variant="ghost" />
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Cómo instalarla</CardTitle>
            <CardDescription>Toma menos de 2 minutos. Necesitas conexión a internet (Wi‑Fi).</CardDescription>
          </CardHeader>
          <CardContent>
            <InstallGuide apn={order.apn} />
          </CardContent>
        </Card>
      </div>

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-subtle">
        <CircleHelp aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Importante: una eSIM solo se puede instalar una vez. No la borres de tu teléfono mientras tengas datos.
      </p>
    </div>
  );
}

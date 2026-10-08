import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleX, Clock, CreditCard, Headset, Lock, TriangleAlert, Undo2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { paymentInstructions } from "@/lib/deposits";
import { getUserDeposit } from "@/lib/queries";
import { openpayEnabled, syncCardDeposit } from "@/lib/openpay";
import { formatMxn } from "@/lib/pricing";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { PageHeader } from "@/components/app/page-header";
import { CopyField, InfoRow } from "@/components/app/copy-field";
import { DepositStatusBadge, methodLabel } from "@/components/app/status-badges";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { formatDateTime } from "@/components/app/format";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Instrucciones de pago" };

const groupClabe = (c: string) => c.replace(/\s/g, "").replace(/(\d{3})(\d{3})(\d{11})(\d)/, "$1 $2 $3 $4");

export default async function DepositPage({ params }: PageProps<"/app/fondos/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  let dep = await getUserDeposit(user.id, id);
  if (!dep) notFound();

  // Tarjeta pendiente: consulta el cargo en Openpay (por si el webhook aún no llega).
  if (dep.method === "card" && dep.status === "pending" && openpayEnabled()) {
    const synced = await syncCardDeposit(dep.id).catch((e) => {
      console.error("syncCardDeposit", e);
      return "pending";
    });
    if (synced !== "pending") dep = (await getUserDeposit(user.id, id)) ?? dep;
  }

  const back = { href: "/app/fondos", label: "Fondos" };
  const amount = formatMxn(dep.amountCents);
  const isCard = dep.method === "card";
  const cardMeta = (dep.meta ?? {}) as { feeCents?: number; chargedCents?: number; error?: string };
  const retryHref = `/app/fondos?monto=${dep.amountCents / 100}&metodo=${isCard ? "tarjeta" : dep.method}`;

  if (dep.status === "completed") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title="Depósito acreditado" action={<DepositStatusBadge status={dep.status} />} />
        <FadeIn immediate>
          <Card variant="gradient" className="p-6 text-center sm:p-10">
            <div className="flex flex-col items-center gap-5">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-success/25 bg-success/10 text-success">
                <CircleCheck aria-hidden className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <p className="font-display text-4xl font-semibold tracking-tight text-fg tabular-nums">+{amount}</p>
                <p className="text-[15px] text-muted">
                  Ya está en tu saldo{dep.completedAt ? ` desde el ${formatDateTime(dep.completedAt)}` : ""}.
                </p>
                {isCard && cardMeta.chargedCents ? (
                  <p className="text-[13px] text-subtle">
                    Cargo a tu tarjeta: <span className="tabular-nums">{formatMxn(cardMeta.chargedCents)}</span>
                    {cardMeta.feeCents ? (
                      <>
                        {" "}
                        (incluye comisión <span className="tabular-nums">{formatMxn(cardMeta.feeCents)}</span>)
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                <Button href="/app/comprar" size="lg" className="w-full sm:w-auto">
                  Comprar un plan
                </Button>
                <Button href="/app" size="lg" variant="secondary" className="w-full sm:w-auto">
                  Ir al inicio
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>
    );
  }

  if (dep.status === "returned") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={`Depósito ${methodLabel(dep.method)}`} action={<DepositStatusBadge status={dep.status} />} />
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col items-start gap-5">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10 text-danger">
              <Undo2 aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-fg">Tu banco devolvió esta transferencia</h2>
              <p className="max-w-prose text-[15px] leading-relaxed text-muted">
                El banco emisor regresó los <span className="text-fg tabular-nums">{amount}</span> a tu cuenta, así que los
                descontamos de tu saldo. Suele pasar por datos del ordenante o límites de tu banco. Si fue un error, vuelve a
                transferir o contacta a soporte con la referencia <span className="font-mono text-fg">{dep.reference}</span>.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <Button href="/app/fondos" className="w-full sm:w-auto">
                Agregar fondos
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

  if (isCard && dep.status === "cancelled") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title="Pago con tarjeta" action={<DepositStatusBadge status={dep.status} />} />
        <FadeIn immediate>
          <Card className="p-6 text-center sm:p-10">
            <div className="flex flex-col items-center gap-5">
              <span className="flex size-14 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10 text-danger">
                <CircleX aria-hidden className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-fg">El pago no se completó</h2>
                <p className="max-w-prose text-[15px] leading-relaxed text-muted">
                  No se hizo ningún cargo a tu tarjeta por {amount}. Puede ser un rechazo del banco o que la verificación 3D
                  Secure no se terminó. Intenta de nuevo o usa otra tarjeta.
                </p>
                {cardMeta.error ? <p className="text-[13px] text-subtle">Motivo: {cardMeta.error}</p> : null}
              </div>
              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                <Button href={retryHref} size="lg" className="w-full sm:w-auto">
                  <CreditCard aria-hidden /> Intentar de nuevo
                </Button>
                <Button href="/app/fondos?metodo=spei" size="lg" variant="secondary" className="w-full sm:w-auto">
                  Pagar con SPEI
                </Button>
              </div>
            </div>
          </Card>
        </FadeIn>
      </div>
    );
  }

  if (isCard) {
    // Pendiente: esperando confirmación de Openpay.
    return (
      <div className="flex flex-col gap-6">
        <AutoRefresh ms={5_000} />
        <PageHeader back={back} title="Pago con tarjeta" action={<DepositStatusBadge status={dep.status} />} />
        <Card className="p-6 text-center sm:p-10" role="status">
          <div className="flex flex-col items-center gap-5">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender">
              <Spinner size={22} label="Confirmando pago" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-fg">Confirmando tu pago…</h2>
              <p className="max-w-prose text-[15px] leading-relaxed text-muted">
                Estamos verificando el cargo de{" "}
                <span className="text-fg tabular-nums">{formatMxn(cardMeta.chargedCents ?? dep.amountCents)}</span> con tu
                banco. Esta pantalla se actualiza sola; suele tardar unos segundos.
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-[13px] text-subtle">
              <Lock aria-hidden className="size-3.5" /> Openpay (BBVA) · 3D Secure
            </p>
          </div>
        </Card>
        <p className="text-[13px] leading-relaxed text-subtle">
          ¿Cerraste la página de pago sin terminar?{" "}
          <Link href={retryHref} className="text-lavender underline-offset-4 hover:underline">
            Inicia un nuevo pago
          </Link>
          . Si ya pagaste, no hagas nada: se acreditará en cuanto tu banco lo confirme.
        </p>
      </div>
    );
  }

  if (dep.status === "expired" || dep.status === "cancelled") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={`Depósito ${methodLabel(dep.method)}`} action={<DepositStatusBadge status={dep.status} />} />
        <Alert
          variant="warning"
          title={dep.status === "expired" ? "Estas instrucciones expiraron" : "Este depósito fue cancelado"}
          action={
            <Button href={retryHref} size="sm">
              Generar nuevas
            </Button>
          }
        >
          No envíes dinero con estos datos. Si ya pagaste, contacta a soporte con tu referencia{" "}
          <span className="font-mono text-fg">{dep.reference}</span>.
        </Alert>
      </div>
    );
  }

  // Pending
  const info = paymentInstructions();
  const isSpei = dep.method !== "usdt";
  const configured = isSpei ? !!info.spei.clabe : !!info.usdt.address;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <AutoRefresh ms={10_000} />
      <PageHeader
        back={back}
        title={isSpei ? "Transfiere por SPEI" : "Envía USDT"}
        description={`Agrega ${amount} a tu saldo.`}
        action={<DepositStatusBadge status={dep.status} />}
      />

      {!configured ? (
        <Alert variant="info" icon={<Headset aria-hidden />} title="Datos de pago disponibles pronto">
          Estamos terminando de habilitar {isSpei ? "las transferencias SPEI" : "los depósitos en USDT"}. Contacta a soporte con
          tu referencia <span className="font-mono text-fg">{dep.reference}</span> y te ayudamos a recargar.
        </Alert>
      ) : (
        <FadeIn immediate>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{isSpei ? "Datos para tu transferencia" : "Datos para tu envío"}</CardTitle>
              <CardDescription>
                {isSpei
                  ? "Desde la app de tu banco, crea una transferencia SPEI con estos datos."
                  : "Desde tu wallet o exchange, envía exactamente este monto."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isSpei ? (
                <>
                  <CopyField
                    label="Referencia / concepto"
                    value={dep.reference}
                    size="lg"
                    hint="Escríbela en el concepto o referencia. Así identificamos tu pago."
                    copyLabel="Copiar referencia"
                    className="border-lavender/30 bg-primary/[0.07]"
                  />
                  <CopyField label="CLABE" value={info.spei.clabe} display={groupClabe(info.spei.clabe)} copyLabel="Copiar CLABE" />
                  <CopyField
                    label="Monto exacto"
                    value={(dep.amountCents / 100).toFixed(2)}
                    display={amount}
                    copyLabel="Copiar monto"
                  />
                  <div className="divide-y divide-border px-1">
                    {info.spei.bank ? <InfoRow label="Banco">{info.spei.bank}</InfoRow> : null}
                    <InfoRow label="Beneficiario">{info.spei.beneficiary}</InfoRow>
                  </div>
                </>
              ) : (
                <>
                  <CopyField
                    label="Monto exacto en USDT"
                    value={dep.expectedUsdt ?? ""}
                    display={`${dep.expectedUsdt} USDT`}
                    size="lg"
                    hint={`Equivale a ${amount}. Los decimales identifican tu pago.`}
                    copyLabel="Copiar monto en USDT"
                    className="border-lavender/30 bg-primary/[0.07]"
                  />
                  <CopyField label="Dirección" value={info.usdt.address} copyLabel="Copiar dirección" />
                  <div className="divide-y divide-border px-1">
                    <InfoRow label="Red">
                      <span className="font-medium">{info.usdt.network}</span>
                    </InfoRow>
                    <InfoRow label="Referencia">
                      <span className="font-mono">{dep.reference}</span>
                    </InfoRow>
                  </div>
                  <Alert variant="warning" icon={<TriangleAlert aria-hidden />} title="Envía solo por esta red">
                    Envía exactamente <span className="font-mono text-fg">{dep.expectedUsdt} USDT</span> por{" "}
                    <span className="text-fg">{info.usdt.network}</span>. Si usas otra red o un monto diferente, el pago no se
                    acreditará automáticamente y podría perderse. Si tu exchange descuenta una comisión del envío, súmala para que llegue el monto exacto.
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div className="flex items-center gap-3 rounded-card border border-border bg-surface/60 px-5 py-4" role="status">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Clock aria-hidden className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-medium text-fg">Esperando tu pago</p>
          <p className="text-[13px] text-muted">
            Esta pantalla se actualiza sola. Te avisaremos por correo cuando se acredite.
          </p>
        </div>
      </div>

      <p className="text-[13px] text-subtle">
        Solicitado el {formatDateTime(dep.createdAt)} · Referencia <span className="font-mono">{dep.reference}</span>
      </p>
    </div>
  );
}

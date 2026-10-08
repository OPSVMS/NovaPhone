import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck, Clock, Headset, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/session";
import { paymentInstructions } from "@/lib/deposits";
import { getUserDeposit } from "@/lib/queries";
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

export const metadata: Metadata = { title: "Instrucciones de pago" };

const groupClabe = (c: string) => c.replace(/\s/g, "").replace(/(\d{3})(\d{3})(\d{11})(\d)/, "$1 $2 $3 $4");

export default async function DepositPage({ params }: PageProps<"/app/fondos/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const dep = await getUserDeposit(user.id, id);
  if (!dep) notFound();

  const back = { href: "/app/fondos", label: "Fondos" };
  const amount = formatMxn(dep.amountCents);

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

  if (dep.status === "expired" || dep.status === "cancelled") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader back={back} title={`Depósito ${methodLabel(dep.method)}`} action={<DepositStatusBadge status={dep.status} />} />
        <Alert
          variant="warning"
          title={dep.status === "expired" ? "Estas instrucciones expiraron" : "Este depósito fue cancelado"}
          action={
            <Button href={`/app/fondos?monto=${dep.amountCents / 100}&metodo=${dep.method}`} size="sm">
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

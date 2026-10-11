import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { asc } from "drizzle-orm";
import { Activity, ArrowRightLeft, Clock, RefreshCw, TriangleAlert, Webhook } from "lucide-react";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { getSystemStatus } from "@/lib/admin";
import { getFxUsdMxn } from "@/lib/queries";
import { formatGb, formatMxn } from "@/lib/pricing";
import { adminReconcileNow, adminSyncCatalog, adminSyncEsims, adminTogglePlan } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton, PlanToggle } from "@/components/app/admin-actions";
import { AdminHeader, SectionTitle, td, th } from "@/components/app/admin-ui";
import { formatDateTime, relativeTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Sistema · Admin" };

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function StatusTile({
  label,
  icon,
  value,
  hint,
  tone,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "warning" | "success";
}) {
  return (
    <Card className="flex flex-col gap-2 p-4 sm:p-5">
      <span className="inline-flex items-center gap-2 text-[13px] text-muted [&_svg]:size-4 [&_svg]:text-lavender">
        {icon}
        {label}
      </span>
      <span className="font-display text-xl font-semibold text-fg tabular-nums">{value}</span>
      {hint ? <span className={clsx("text-[13px]", tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-subtle")}>{hint}</span> : null}
    </Card>
  );
}

const HOUR = 3_600_000;

export default async function AdminSystemPage() {
  await requireAdmin();
  const [status, plans, fx] = await Promise.all([
    getSystemStatus(),
    db.query.plans.findMany({ orderBy: [asc(schema.plans.countryCode), asc(schema.plans.dataGb), asc(schema.plans.days)] }),
    getFxUsdMxn(),
  ]);
  const now = new Date().getTime();
  const ago = (d: Date | null) => (d ? now - new Date(d).getTime() : Infinity);
  const fxStale = ago(status.fx?.updatedAt ?? null) > 36 * HOUR;
  const syncStale = ago(status.lastUsageSync) > 6 * HOUR;
  const activePlans = plans.filter((p) => p.active).length;

  return (
    <div className="flex flex-col gap-10 pb-12">
      <AdminHeader title="Sistema" description="Sincronizaciones, proveedores y catálogo de planes." />

      <section aria-labelledby="status" className="flex flex-col gap-3">
        <SectionTitle id="status">Estado</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusTile
            label="Tipo de cambio"
            icon={<ArrowRightLeft aria-hidden />}
            value={status.fx ? status.fx.value.toFixed(4) : fx.toFixed(4)}
            hint={status.fx ? `Actualizado ${relativeTime(status.fx.updatedAt, now)}` : "Usando valor de respaldo"}
            tone={fxStale ? "warning" : undefined}
          />
          <StatusTile
            label="Última sincronización de consumo"
            icon={<Activity aria-hidden />}
            value={status.lastUsageSync ? relativeTime(status.lastUsageSync, now) : "Nunca"}
            hint={status.lastUsageSync ? formatDateTime(status.lastUsageSync) : "El cron aún no ha corrido"}
            tone={syncStale ? "warning" : undefined}
          />
          <StatusTile
            label="Último webhook de proveedor"
            icon={<Webhook aria-hidden />}
            value={status.lastProviderWebhook ? relativeTime(status.lastProviderWebhook, now) : "Nunca"}
            hint={status.lastProviderWebhook ? formatDateTime(status.lastProviderWebhook) : "Sin eventos recibidos"}
          />
          <StatusTile
            label="Órdenes atascadas"
            icon={<Clock aria-hidden />}
            value={status.stuckOrders.length}
            hint={status.stuckOrders.length ? "Generándose hace más de 10 min" : "Todo en orden"}
            tone={status.stuckOrders.length ? "warning" : "success"}
          />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catálogo de eSIM Access</CardTitle>
            <CardDescription>Vuelve a traer planes, costos y el tipo de cambio. Los precios se recalculan.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionButton action={adminSyncCatalog} pendingText="Sincronizando…">
              <RefreshCw aria-hidden /> Sincronizar catálogo
            </ActionButton>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">NOVACORE</CardTitle>
            <CardDescription>Revisa los SPEI de los últimos 7 días y acredita los que falten.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionButton action={adminReconcileNow} pendingText="Conciliando…">
              <RefreshCw aria-hidden /> Conciliar NOVACORE ahora
            </ActionButton>
          </CardContent>
        </Card>
      </div>

      {status.stuckOrders.length ? (
        <section aria-labelledby="stuck" className="flex flex-col gap-3">
          <SectionTitle id="stuck" count={status.stuckOrders.length} aside={<TriangleAlert aria-hidden className="size-4 text-warning" />}>
            Órdenes atascadas
          </SectionTitle>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {status.stuckOrders.map((o) => (
                <li key={o.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-fg">{o.planName}</span>
                    <span className="truncate text-[12px] text-subtle">
                      Creada {formatDateTime(o.createdAt)} ({relativeTime(o.createdAt, now)}) ·{" "}
                      <span className="font-mono">{o.providerOrderNo ?? o.id}</span>
                    </span>
                    {o.error ? <span className="text-[12px] text-danger">{o.error}</span> : null}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/admin/usuarios/${o.userId}`}
                      className="inline-flex h-9 items-center rounded-[10px] px-3 text-sm text-lavender hover:bg-white/[0.05] hover:text-lavender-soft"
                    >
                      Ver usuario
                    </Link>
                    <ActionButton action={adminSyncEsims} fields={{ orderId: o.id, userId: o.userId }} pendingText="Sincronizando…">
                      <RefreshCw aria-hidden /> Sincronizar
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="catalog" className="flex flex-col gap-3">
        <SectionTitle id="catalog" count={plans.length} aside={<Badge variant="success">{activePlans} activos</Badge>}>
          Catálogo
        </SectionTitle>
        {plans.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong px-5 py-10 text-center text-sm text-muted">
            Sin planes. Sincroniza el catálogo.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-border">
                  <tr>
                    <th className={th}>Plan</th>
                    <th className={`${th} text-right`}>Datos</th>
                    <th className={`${th} text-right`}>Días</th>
                    <th className={`${th} text-right`}>Costo USD</th>
                    <th className={`${th} text-right`}>Precio MXN</th>
                    <th className={`${th} text-right`}>Margen</th>
                    <th className={`${th} text-right`}>Activo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plans.map((p) => {
                    const costMxn = p.costUsd * fx;
                    const margin = p.priceMxn > 0 ? Math.round(((p.priceMxn - costMxn) / p.priceMxn) * 100) : 0;
                    return (
                      <tr key={p.id} className={clsx("transition-colors hover:bg-white/[0.03]", !p.active && "opacity-60")}>
                        <td className={td}>
                          <p className="flex items-center gap-2 font-medium text-fg">
                            {p.name}
                            {p.featured ? <Badge variant="accent">Destacado</Badge> : null}
                            {p.daily ? <Badge variant="neutral">Diario</Badge> : null}
                          </p>
                          <p className="font-mono text-[12px] text-subtle">{p.id}</p>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{formatGb(p.dataGb)}</td>
                        <td className={`${td} text-right tabular-nums`}>{p.days}</td>
                        <td className={`${td} text-right tabular-nums text-muted`}>{usd(p.costUsd)}</td>
                        <td className={`${td} text-right font-display font-semibold tabular-nums text-fg`}>{formatMxn(p.priceMxn * 100)}</td>
                        <td className={clsx(td, "text-right tabular-nums", margin < 10 ? "text-danger" : margin < 20 ? "text-warning" : "text-success")}>
                          {margin}%
                        </td>
                        <td className={`${td} text-right`}>
                          <div className="flex justify-end">
                            <PlanToggle planId={p.id} active={p.active} name={p.name} action={adminTogglePlan} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <p className="text-[12px] text-subtle">Margen calculado con tipo de cambio {fx.toFixed(4)} sin comisiones de cobro.</p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CardSim,
  CircleDollarSign,
  Clock,
  Landmark,
  MessageSquareText,
  PiggyBank,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getActivity, getOverview } from "@/lib/admin";
import { getAdminStats, getPendingDeposits } from "@/lib/queries";
import { formatMxn } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { methodLabel } from "@/components/app/status-badges";
import { AdminDepositActions } from "@/components/app/admin-deposit-actions";
import { ActivityFeed } from "@/components/app/admin-activity";
import { AdminHeader, Kpi, SectionTitle, money, td, th } from "@/components/app/admin-ui";
import { formatDateTime } from "@/components/app/format";
import type { Deposit } from "@/db/schema";

export const metadata: Metadata = { title: "Resumen · Admin" };

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const n = (v: number) => v.toLocaleString("es-MX");

function KpiGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <h2 className="text-[12px] font-medium uppercase tracking-wider text-subtle">{title}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function ProviderRow({ name, status, detail }: { name: string; status: ReactNode; detail?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{name}</span>
        {detail ? <span className="truncate text-[13px] text-subtle">{detail}</span> : null}
      </div>
      <div className="shrink-0">{status}</div>
    </li>
  );
}

const enabledBadge = (on: boolean) =>
  on ? (
    <Badge variant="success" dot>
      Activo
    </Badge>
  ) : (
    <Badge variant="neutral">No configurado</Badge>
  );

export default async function AdminPage() {
  await requireAdmin();
  const [o, stats, pending, activity] = await Promise.all([getOverview(), getAdminStats(), getPendingDeposits(), getActivity(10)]);
  const now = new Date().getTime();

  const esa = o.providers.esimAccessUsd;
  const cn = o.providers.cloudnumbering;
  const esaLow = esa !== null && esa < 50;
  const cnLow = cn !== null && cn.balance < 20;
  const depTotal = o.deposits30.reduce((a, d) => a + d.cents, 0);
  const marginPct = o.sales.all > 0 ? Math.round((o.estimatedMarginCents / o.sales.all) * 100) : 0;

  return (
    <div className="flex flex-col gap-10 pb-12">
      <AdminHeader title="Resumen" description="Operación de NovaPhone en tiempo real." />

      {esaLow || cnLow || o.esims.provisioning > 0 ? (
        <div className="flex flex-wrap gap-2" role="status">
          {esaLow ? <Badge variant="warning" dot="pulse">Saldo eSIM Access bajo: {usd(esa!)}</Badge> : null}
          {cnLow ? (
            <Badge variant="warning" dot="pulse">
              Saldo cloudnumbering bajo: {cn!.balance.toFixed(2)} {cn!.currency}
            </Badge>
          ) : null}
          {o.esims.provisioning > 0 ? (
            <Link href="/admin/esims?status=provisioning">
              <Badge variant="warning" dot="pulse">
                {o.esims.provisioning} eSIM(s) generándose
              </Badge>
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <KpiGroup title="Usuarios">
          <Kpi label="Usuarios" icon={<Users aria-hidden />} value={n(o.users.total)} hint={`${n(o.users.disabled)} suspendidos`} />
          <Kpi label="Nuevos 7 días" icon={<UserPlus aria-hidden />} value={n(o.users.new7)} hint="Registros de la semana" />
          <Kpi label="Activos hoy" icon={<UserCheck aria-hidden />} value={n(o.users.active1)} hint={`${n(o.users.active7)} en 7 días`} />
          <Kpi label="Con CLABE" icon={<Landmark aria-hidden />} value={n(o.users.with_clabe)} hint="Cuenta SPEI personal" />
        </KpiGroup>

        <KpiGroup title="eSIMs">
          <Kpi label="eSIMs activas" icon={<CardSim aria-hidden />} value={n(o.esims.active)} hint={`${n(o.esims.total)} vendidas en total`} />
          <Kpi label="Instaladas" icon={<CardSim aria-hidden />} value={n(o.esims.installed)} hint="Perfil encendido en el teléfono" />
          <Kpi label="Vendidas 30 días" icon={<TrendingUp aria-hidden />} value={n(o.esims.sold30)} hint="Órdenes del mes" />
          <Kpi
            label="Generando"
            icon={<Clock aria-hidden />}
            value={n(o.esims.provisioning)}
            hint={o.esims.provisioning ? "Revisa si alguna está atascada" : "Sin pendientes"}
            tone={o.esims.provisioning ? "warning" : undefined}
          />
        </KpiGroup>

        <KpiGroup title="Ventas">
          <Kpi label="Ventas hoy" icon={<CircleDollarSign aria-hidden />} value={formatMxn(o.sales.today)} hint="Últimas 24 h" />
          <Kpi label="Ventas 7 días" icon={<CircleDollarSign aria-hidden />} value={formatMxn(o.sales.week)} />
          <Kpi label="Ventas 30 días" icon={<CircleDollarSign aria-hidden />} value={formatMxn(o.sales.month)} />
          <Kpi
            label="Ventas totales"
            icon={<CircleDollarSign aria-hidden />}
            value={formatMxn(o.sales.all)}
            hint={o.sales.refunds ? `${formatMxn(o.sales.refunds)} reembolsados` : "Sin reembolsos"}
          />
        </KpiGroup>

        <KpiGroup title="Finanzas">
          <Kpi
            label="Margen estimado eSIMs"
            icon={<TrendingUp aria-hidden />}
            value={formatMxn(o.estimatedMarginCents)}
            hint={`${marginPct}% · TC ${o.fx.toFixed(2)}`}
            tone={o.estimatedMarginCents < 0 ? "danger" : undefined}
          />
          <Kpi label="Saldo de usuarios" icon={<Wallet aria-hidden />} value={formatMxn(o.usersBalanceCents)} hint="Pasivo: saldo por consumir" />
          <Kpi label="Depositado 30 días" icon={<PiggyBank aria-hidden />} value={formatMxn(depTotal)} hint="Depósitos acreditados" />
          <Kpi
            label="Números asignados"
            icon={<MessageSquareText aria-hidden />}
            value={n(o.numbers.assigned)}
            hint={`${n(o.numbers.available)} disponibles${o.numbers.grace ? ` · ${o.numbers.grace} en gracia` : ""}`}
            tone={o.numbers.grace ? "warning" : undefined}
          />
        </KpiGroup>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
        <section aria-labelledby="providers" className="flex min-w-0 flex-col gap-3">
          <SectionTitle id="providers">Proveedores</SectionTitle>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              <ProviderRow
                name="eSIM Access"
                detail={esa === null ? "No se pudo leer el saldo" : esaLow ? "Recarga pronto (mín. recomendado $50 USD)" : "Saldo del proveedor de eSIMs"}
                status={
                  esa === null ? (
                    <Badge variant="danger">Sin datos</Badge>
                  ) : (
                    <Badge variant={esaLow ? "warning" : "success"} dot={esaLow ? "pulse" : true}>
                      <span className="tabular-nums">{usd(esa)}</span>
                    </Badge>
                  )
                }
              />
              <ProviderRow
                name="cloudnumbering"
                detail={cn === null ? "No configurado o sin respuesta" : cnLow ? "Recarga pronto (mín. recomendado £20)" : "Saldo para números virtuales"}
                status={
                  cn === null ? (
                    <Badge variant="neutral">Sin datos</Badge>
                  ) : (
                    <Badge variant={cnLow ? "warning" : "success"} dot={cnLow ? "pulse" : true}>
                      <span className="tabular-nums">
                        {cn.balance.toFixed(2)} {cn.currency}
                      </span>
                    </Badge>
                  )
                }
              />
              <ProviderRow name="NOVACORE" detail="SPEI y CLABEs personales" status={enabledBadge(o.providers.novacore)} />
              <ProviderRow name="Stripe" detail="Pagos con tarjeta (MXN)" status={enabledBadge(o.providers.stripe)} />
              <ProviderRow name="Correo" detail="Envío de correos transaccionales" status={enabledBadge(o.providers.email)} />
              <ProviderRow
                name="Tipo de cambio"
                detail="USD → MXN"
                status={<span className="font-display text-sm font-semibold text-fg tabular-nums">{o.fx.toFixed(4)}</span>}
              />
            </ul>
          </Card>
        </section>

        <section aria-labelledby="deposits30" className="flex min-w-0 flex-col gap-3">
          <SectionTitle id="deposits30" aside={<span className={`${money} text-sm`}>{formatMxn(depTotal)}</span>}>
            Depósitos 30 días por método
          </SectionTitle>
          <Card className="p-4 sm:p-5">
            {o.deposits30.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Sin depósitos acreditados en 30 días.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {[...o.deposits30]
                  .sort((a, b) => b.cents - a.cents)
                  .map((d) => {
                    const pct = depTotal ? Math.round((d.cents / depTotal) * 100) : 0;
                    return (
                      <li key={d.method} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <Link href={`/admin/depositos?method=${d.method}&status=completed`} className="font-medium text-fg hover:text-lavender-soft">
                            {methodLabel(d.method as Deposit["method"])}
                          </Link>
                          <span className="text-muted tabular-nums">
                            <span className="font-display font-semibold text-fg">{formatMxn(d.cents)}</span> · {n(d.n)} dep. · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                          <div className="h-full rounded-full bg-linear-to-r from-primary to-lavender" style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {/* Pending deposits */}
      <section aria-labelledby="pending" className="flex flex-col gap-3">
        <SectionTitle
          id="pending"
          aside={
            pending.length > 0 ? (
              <Badge variant="warning" dot="pulse">
                {pending.length} · {formatMxn(stats.pendingDepositsCents)}
              </Badge>
            ) : null
          }
        >
          Depósitos pendientes
        </SectionTitle>
        {pending.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">
            <Clock aria-hidden className="mx-auto mb-2 size-5 text-subtle" />
            No hay depósitos por revisar.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className={th}>Usuario</th>
                    <th className={th}>Método</th>
                    <th className={th}>Referencia</th>
                    <th className={`${th} text-right`}>Monto</th>
                    <th className={th}>Fecha</th>
                    <th className={`${th} text-right`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pending.map((d) => (
                    <tr key={d.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className={td}>
                        <p className="font-medium text-fg">{d.userName}</p>
                        <p className="text-[13px] text-subtle">{d.userEmail}</p>
                      </td>
                      <td className={td}>
                        <Badge variant="neutral">{methodLabel(d.method)}</Badge>
                      </td>
                      <td className={`${td} font-mono text-fg`}>{d.reference}</td>
                      <td className={`${td} text-right`}>
                        <p className={money}>{formatMxn(d.amountCents)}</p>
                        {d.expectedUsdt ? <p className="font-mono text-[12px] text-subtle">{d.expectedUsdt} USDT</p> : null}
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(d.createdAt)}</td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end">
                          <AdminDepositActions
                            depositId={d.id}
                            amount={formatMxn(d.amountCents)}
                            email={d.userEmail}
                            reference={d.reference}
                            method={methodLabel(d.method)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {pending.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{d.userName}</p>
                      <p className="truncate text-[13px] text-subtle">{d.userEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className={money}>{formatMxn(d.amountCents)}</p>
                      {d.expectedUsdt ? <p className="font-mono text-[12px] text-subtle">{d.expectedUsdt} USDT</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[13px] text-muted">
                    <span>
                      {methodLabel(d.method)} · <span className="font-mono text-fg">{d.reference}</span>
                    </span>
                    <span>{formatDateTime(d.createdAt)}</span>
                  </div>
                  <AdminDepositActions
                    depositId={d.id}
                    amount={formatMxn(d.amountCents)}
                    email={d.userEmail}
                    reference={d.reference}
                    method={methodLabel(d.method)}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="activity" className="flex flex-col gap-3">
        <SectionTitle
          id="activity"
          aside={
            <Link href="/admin/actividad" className="inline-flex items-center gap-1 text-sm text-lavender hover:text-lavender-soft">
              Ver toda la actividad <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
        >
          Actividad reciente
        </SectionTitle>
        <Card className="overflow-hidden">
          <ActivityFeed items={activity} now={now} />
        </Card>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CardSim, CircleDollarSign, Clock, Server, TrendingUp, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getBalanceUsd } from "@/lib/esimaccess";
import { getAdminStats, getPendingDeposits, getRecentOrders, getRecentUsers } from "@/lib/queries";
import { formatMxn } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { OrderStatusBadge, methodLabel } from "@/components/app/status-badges";
import { AdminDepositActions } from "@/components/app/admin-deposit-actions";
import { formatDateTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Admin" };

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

async function providerBalance() {
  try {
    return await getBalanceUsd();
  } catch {
    return null;
  }
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-fg">{children}</h2>
      {aside}
    </div>
  );
}

const th = "px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-subtle";
const td = "px-5 py-3.5 text-sm";

export default async function AdminPage() {
  await requireAdmin();
  const [stats, balanceUsd, pending, orders, users] = await Promise.all([
    getAdminStats(),
    providerBalance(),
    getPendingDeposits(),
    getRecentOrders(10),
    getRecentUsers(10),
  ]);

  const tiles = [
    {
      label: "Saldo proveedor",
      icon: <Server aria-hidden />,
      value: balanceUsd === null ? "—" : usd(balanceUsd),
      hint: balanceUsd === null ? "No disponible" : balanceUsd < 50 ? "Recarga pronto" : "eSIM Access",
      warn: balanceUsd !== null && balanceUsd < 50,
    },
    { label: "Usuarios", icon: <Users aria-hidden />, value: stats.users.toLocaleString("es-MX"), hint: "Registrados" },
    { label: "eSIMs vendidas", icon: <CardSim aria-hidden />, value: stats.esimsSold.toLocaleString("es-MX"), hint: "Listas o en proceso" },
    { label: "Ingresos", icon: <CircleDollarSign aria-hidden />, value: formatMxn(stats.revenueCents), hint: "MXN cobrados en eSIMs" },
    {
      label: "Margen estimado",
      icon: <TrendingUp aria-hidden />,
      value: formatMxn(stats.marginCents),
      hint: `${Math.round(stats.marginPct * 100)}% · TC ${stats.fx.toFixed(2)}`,
    },
  ];

  return (
    <div className="flex flex-col gap-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">Panel</h1>
        <p className="text-[15px] text-muted">Operación de NovaPhone en tiempo real.</p>
      </div>

      <Stagger immediate className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <StaggerItem key={t.label} className={i === 0 ? "col-span-2 lg:col-span-1" : undefined}>
            <Card className="h-full p-4 sm:p-5">
              <Stat
                label={t.label}
                icon={t.icon}
                value={t.value}
                hint={t.warn ? <span className="text-warning">{t.hint}</span> : t.hint}
              />
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Pending deposits */}
      <section aria-labelledby="pending" className="flex flex-col gap-3">
        <SectionTitle
          aside={
            pending.length > 0 ? (
              <Badge variant="warning" dot="pulse">
                {pending.length} · {formatMxn(stats.pendingDepositsCents)}
              </Badge>
            ) : null
          }
        >
          <span id="pending">Depósitos pendientes</span>
        </SectionTitle>
        {pending.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">
            <Clock aria-hidden className="mx-auto mb-2 size-5 text-subtle" />
            No hay depósitos por revisar.
          </p>
        ) : (
          <Card className="overflow-hidden">
            {/* Desktop table */}
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
                        <p className="font-display font-semibold text-fg tabular-nums">{formatMxn(d.amountCents)}</p>
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
            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {pending.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{d.userName}</p>
                      <p className="truncate text-[13px] text-subtle">{d.userEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-semibold text-fg tabular-nums">{formatMxn(d.amountCents)}</p>
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

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
        {/* Recent orders */}
        <section aria-labelledby="orders" className="flex min-w-0 flex-col gap-3">
          <SectionTitle>
            <span id="orders">Órdenes recientes</span>
          </SectionTitle>
          <Card className="overflow-hidden">
            {orders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Sin órdenes todavía.</p>
            ) : (
              <ul className="divide-y divide-border">
                {orders.map((o) => {
                  const marginCents = o.priceCents - Math.round(o.costUsd * stats.fx * 100);
                  return (
                    <li key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="truncate text-sm font-medium text-fg">{o.planName}</p>
                        <p className="truncate text-[13px] text-subtle">
                          {o.userEmail} · {formatDateTime(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-display text-sm font-semibold text-fg tabular-nums">{formatMxn(o.priceCents)}</span>
                        <span className="text-[12px] text-subtle tabular-nums">
                          {usd(o.costUsd)} · {marginCents >= 0 ? "+" : "−"}
                          {formatMxn(Math.abs(marginCents))}
                        </span>
                      </div>
                      <div className="hidden shrink-0 sm:block">
                        <OrderStatusBadge status={o.status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {/* Recent users */}
        <section aria-labelledby="users" className="flex min-w-0 flex-col gap-3">
          <SectionTitle>
            <span id="users">Usuarios recientes</span>
          </SectionTitle>
          <Card className="overflow-hidden">
            {users.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Sin usuarios todavía.</p>
            ) : (
              <ul className="divide-y divide-border">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-fg">
                        <span className="truncate">{u.name}</span>
                        {u.role === "admin" ? <Badge variant="primary">Admin</Badge> : null}
                        {!u.verified ? <Badge variant="neutral">Sin verificar</Badge> : null}
                      </p>
                      <p className="truncate text-[13px] text-subtle">
                        {u.email} · {formatDateTime(u.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-sm font-semibold text-fg tabular-nums">
                      {formatMxn(u.balanceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

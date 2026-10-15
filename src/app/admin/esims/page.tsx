import type { Metadata } from "next";
import clsx from "clsx";
import { CardSim } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listOrders } from "@/lib/admin";
import { formatMxn } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminHeader, FilterChips, SearchBox, UserLink, hrefWith, money, param, td, th } from "@/components/app/admin-ui";
import { InstallStatusBadge, OrderStatusBadge } from "@/components/app/status-badges";
import { daysLeft, formatBytes, formatDate, formatDateTime } from "@/components/app/format";
import type { Order } from "@/db/schema";

export const metadata: Metadata = { title: "eSIMs · Admin" };

const STATUSES = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Activas" },
  { value: "expired", label: "Vencidas" },
  { value: "provisioning", label: "Generando" },
  { value: "refunded", label: "Reembolsadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "failed", label: "Fallidas" },
];

const STUCK_MS = 10 * 60_000;

function Usage({ o }: { o: Order }) {
  const total = Number(o.totalBytes ?? 0);
  if (!total) return <span className="text-subtle">—</span>;
  const used = Number(o.usedBytes ?? 0);
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div className="flex w-28 flex-col gap-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-label="Datos usados" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={clsx("h-full rounded-full", pct >= 85 ? "bg-warning" : "bg-lavender")} style={{ width: `${Math.max(pct, used ? 2 : 0)}%` }} />
      </div>
      <span className="text-[12px] text-muted tabular-nums">
        {formatBytes(used)} / {formatBytes(total)}
      </span>
    </div>
  );
}

export default async function AdminEsimsPage({ searchParams }: PageProps<"/admin/esims">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 100);
  const s = param(sp.status);
  const status = STATUSES.some((x) => x.value === s) ? s : "all";
  const rows = await listOrders({ status, q, limit: 200 });
  const now = new Date().getTime();
  const isStuck = (o: Order) => o.status === "provisioning" && now - o.createdAt.getTime() > STUCK_MS;
  const isExpired = (o: Order) => o.status === "ready" && !!o.expiresAt && o.expiresAt.getTime() < now;
  const stuckCount = rows.filter((r) => isStuck(r.order)).length;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <AdminHeader
        title="eSIMs"
        description={
          <>
            <span className="tabular-nums">{rows.length.toLocaleString("es-MX")}</span>
            {rows.length === 200 ? "+" : ""} eSIMs{q || status !== "all" ? " con estos filtros" : ""}.
            {stuckCount ? <span className="text-warning"> {stuckCount} atascada(s) generándose.</span> : null}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <SearchBox action="/admin/esims" q={q} placeholder="Correo, ICCID, plan u orden" keep={{ status }} label="Buscar eSIMs" />
        <FilterChips
          label="Filtrar por estado"
          chips={STATUSES}
          current={status}
          hrefFor={(v) => hrefWith("/admin/esims", { q, status: v })}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<CardSim />} title="Sin eSIMs" description={q ? `No encontramos eSIMs para “${q}”.` : "No hay eSIMs con este filtro."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>Usuario</th>
                  <th className={th}>Plan</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Instalación</th>
                  <th className={th}>Consumo</th>
                  <th className={th}>Vence</th>
                  <th className={th}>Creada</th>
                  <th className={`${th} text-right`}>Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ order: o, email, name, cardCheckoutId, cardFlag }) => {
                  const stuck = isStuck(o);
                  const days = daysLeft(o.expiresAt, now);
                  return (
                    <tr key={o.id} className={clsx("relative transition-colors", stuck ? "bg-warning/[0.06] hover:bg-warning/[0.09]" : "hover:bg-white/[0.03]")}>
                      <td className={`${td} max-w-60`}>
                        <UserLink id={o.userId} email={email} name={name} stretched />
                      </td>
                      <td className={`${td} max-w-56`}>
                        <p className="truncate text-fg">{o.planName}</p>
                        <p className="truncate font-mono text-[12px] text-subtle">{o.iccid ?? o.providerOrderNo ?? "—"}</p>
                      </td>
                      <td className={td}>
                        <div className="flex flex-col items-start gap-1">
                          <OrderStatusBadge status={o.status} expired={isExpired(o)} suspended={o.suspended} />
                          {stuck ? <Badge variant="danger">Atascada</Badge> : null}
                        </div>
                      </td>
                      <td className={td}>{o.status === "ready" ? <InstallStatusBadge smdpStatus={o.smdpStatus} /> : <span className="text-subtle">—</span>}</td>
                      <td className={td}>
                        <Usage o={o} />
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>
                        {o.expiresAt ? (
                          <>
                            {formatDate(o.expiresAt, { day: "numeric", month: "short" })}
                            {days !== null && o.status === "ready" ? <span className="text-subtle"> · {days} d</span> : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(o.createdAt)}</td>
                      <td className={`${td} text-right`}>
                        <span className={money}>{formatMxn(o.priceCents)}</span>
                        {cardCheckoutId ? (
                          <span className="mt-1 flex justify-end gap-1">
                            <Badge variant="primary">Tarjeta</Badge>
                            {cardFlag ? <Badge variant="danger">{cardFlag.startsWith("dispute") ? "Disputa" : "Reembolso"}</Badge> : null}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border lg:hidden">
            {rows.map(({ order: o, email, cardCheckoutId }) => {
              const stuck = isStuck(o);
              return (
                <li key={o.id} className={clsx("relative flex flex-col gap-2.5 p-4", stuck && "bg-warning/[0.06]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">{o.planName}</span>
                      <UserLink id={o.userId} email={email} stretched />
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={money}>{formatMxn(o.priceCents)}</span>
                      {cardCheckoutId ? <Badge variant="primary">Tarjeta</Badge> : null}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <OrderStatusBadge status={o.status} expired={isExpired(o)} suspended={o.suspended} />
                    {o.status === "ready" ? <InstallStatusBadge smdpStatus={o.smdpStatus} /> : null}
                    {stuck ? <Badge variant="danger">Atascada</Badge> : null}
                  </div>
                  {o.status === "ready" ? <Usage o={o} /> : null}
                  <p className="flex flex-wrap gap-x-3 text-[12px] text-subtle">
                    <span>Creada {formatDateTime(o.createdAt)}</span>
                    {o.expiresAt ? <span>Vence {formatDate(o.expiresAt)}</span> : null}
                    {o.iccid ? <span className="font-mono">{o.iccid}</span> : null}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { ArrowDownLeft, RefreshCw } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listDeposits } from "@/lib/admin";
import { formatMxn } from "@/lib/pricing";
import { adminReconcileNow } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/app/admin-actions";
import { AdminDepositActions } from "@/components/app/admin-deposit-actions";
import { AdminHeader, FilterChips, SearchBox, UserLink, hrefWith, money, param, td, th } from "@/components/app/admin-ui";
import { DepositStatusBadge, methodLabel } from "@/components/app/status-badges";
import { formatDateTime } from "@/components/app/format";
import type { Deposit } from "@/db/schema";

export const metadata: Metadata = { title: "Depósitos · Admin" };

const METHODS = [
  { value: "all", label: "Todos" },
  { value: "spei", label: "SPEI" },
  { value: "usdt", label: "USDT" },
  { value: "card", label: "Tarjeta" },
  { value: "manual", label: "Manual" },
];

const STATUSES = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "completed", label: "Acreditados" },
  { value: "expired", label: "Expirados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "returned", label: "Devueltos" },
];

const pick = (list: { value: string }[], v: string) => (list.some((x) => x.value === v) ? v : "all");

const meta = (d: Deposit, k: string) => (typeof d.meta?.[k] === "string" ? (d.meta[k] as string) : null);

function SourceBadge({ d }: { d: Deposit }) {
  const src = meta(d, "source");
  const flag = meta(d, "flagReason");
  if (meta(d, "provider") === "stripe") {
    return (
      <span className="inline-flex flex-wrap gap-1">
        <Badge variant="primary">{meta(d, "kind") === "esim" ? "Stripe · compra eSIM" : "Stripe · saldo"}</Badge>
        {flag ? <Badge variant="danger">{flag.startsWith("dispute") ? "Disputa" : "Reembolso"}</Badge> : null}
      </span>
    );
  }
  if (src === "webhook") return <Badge variant="neutral">Webhook</Badge>;
  if (src === "reconcile") return <Badge variant="primary">Conciliación</Badge>;
  if (d.meta?.approvedManually) return <Badge variant="warning">Aprobado a mano</Badge>;
  return <span className="text-subtle">—</span>;
}

const canReview = (d: Deposit) => d.status === "pending" && d.method !== "card";

export default async function AdminDepositsPage({ searchParams }: PageProps<"/admin/depositos">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 100);
  const method = pick(METHODS, param(sp.method));
  const status = pick(STATUSES, param(sp.status));
  const rows = await listDeposits({ method, status, q, limit: 200 });
  const total = rows.filter((r) => r.deposit.status === "completed").reduce((a, r) => a + r.deposit.amountCents, 0);
  const href = (p: { method?: string; status?: string }) => hrefWith("/admin/depositos", { q, method: p.method ?? method, status: p.status ?? status });

  return (
    <div className="flex flex-col gap-6 pb-12">
      <AdminHeader
        title="Depósitos"
        description={
          <>
            <span className="tabular-nums">{rows.length.toLocaleString("es-MX")}</span>
            {rows.length === 200 ? "+" : ""} depósitos · <span className="tabular-nums">{formatMxn(total)}</span> acreditados en esta vista.
          </>
        }
        action={
          <ActionButton action={adminReconcileNow} size="md" pendingText="Conciliando…">
            <RefreshCw aria-hidden /> Conciliar NOVACORE ahora
          </ActionButton>
        }
      />

      <div className="flex flex-col gap-3">
        <SearchBox action="/admin/depositos" q={q} placeholder="Correo, referencia o clave de rastreo" keep={{ method, status }} label="Buscar depósitos" />
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-6">
          <FilterChips label="Filtrar por método" chips={METHODS} current={method} hrefFor={(v) => href({ method: v })} />
          <FilterChips label="Filtrar por estado" chips={STATUSES} current={status} hrefFor={(v) => href({ status: v })} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ArrowDownLeft />} title="Sin depósitos" description={q ? `No encontramos depósitos para “${q}”.` : "No hay depósitos con estos filtros."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>Usuario</th>
                  <th className={th}>Método</th>
                  <th className={`${th} text-right`}>Monto</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Referencia</th>
                  <th className={th}>Ordenante</th>
                  <th className={th}>Origen</th>
                  <th className={th}>Fechas</th>
                  <th className={`${th} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ deposit: d, email, name }) => (
                  <tr key={d.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className={`${td} max-w-56`}>
                      <UserLink id={d.userId} email={email} name={name} />
                    </td>
                    <td className={td}>
                      <Badge variant="neutral">{methodLabel(d.method)}</Badge>
                    </td>
                    <td className={`${td} text-right`}>
                      <p className={money}>{formatMxn(d.amountCents)}</p>
                      {d.expectedUsdt ? <p className="font-mono text-[12px] text-subtle">{d.expectedUsdt} USDT</p> : null}
                    </td>
                    <td className={td}>
                      <DepositStatusBadge status={d.status} />
                    </td>
                    <td className={`${td} max-w-48`}>
                      <p className="truncate font-mono text-[13px] text-fg">{d.reference}</p>
                      {d.externalId ? (
                        <p className="truncate font-mono text-[11px] text-subtle" title={d.externalId}>
                          {d.externalId}
                        </p>
                      ) : null}
                    </td>
                    <td className={`${td} max-w-44 truncate text-muted`}>{meta(d, "payerName") ?? "—"}</td>
                    <td className={td}>
                      <SourceBadge d={d} />
                    </td>
                    <td className={`${td} whitespace-nowrap text-[13px]`}>
                      <p className="text-muted">{formatDateTime(d.createdAt)}</p>
                      {d.completedAt ? <p className="text-subtle">Acreditado {formatDateTime(d.completedAt)}</p> : null}
                    </td>
                    <td className={`${td} text-right`}>
                      {canReview(d) ? (
                        <div className="flex justify-end">
                          <AdminDepositActions
                            depositId={d.id}
                            amount={formatMxn(d.amountCents)}
                            email={email}
                            reference={d.reference}
                            method={methodLabel(d.method)}
                          />
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border lg:hidden">
            {rows.map(({ deposit: d, email }) => (
              <li key={d.id} className="flex flex-col gap-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <UserLink id={d.userId} email={email} />
                    <p className="text-[12px] text-subtle">{formatDateTime(d.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={money}>{formatMxn(d.amountCents)}</span>
                    <DepositStatusBadge status={d.status} />
                  </div>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span>{methodLabel(d.method)}</span>
                  <span className="font-mono text-fg">{d.reference}</span>
                  {meta(d, "payerName") ? <span>{meta(d, "payerName")}</span> : null}
                  <SourceBadge d={d} />
                </p>
                {d.externalId ? <p className="truncate font-mono text-[11px] text-subtle">Rastreo {d.externalId}</p> : null}
                {canReview(d) ? (
                  <AdminDepositActions
                    depositId={d.id}
                    amount={formatMxn(d.amountCents)}
                    email={email}
                    reference={d.reference}
                    method={methodLabel(d.method)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import clsx from "clsx";
import { ArrowLeftRight } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listLedger } from "@/lib/admin";
import { formatMxn } from "@/lib/pricing";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminHeader, FilterChips, UserLink, hrefWith, param, td, th } from "@/components/app/admin-ui";
import { formatDateTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Movimientos · Admin" };

const KINDS = [
  { value: "all", label: "Todos" },
  { value: "purchase", label: "Compras" },
  { value: "deposit", label: "Depósitos" },
  { value: "refund", label: "Reembolsos" },
  { value: "adjustment", label: "Ajustes" },
];

const KIND_BADGE: Record<string, { label: string; variant: BadgeVariant }> = {
  purchase: { label: "Compra", variant: "primary" },
  deposit: { label: "Depósito", variant: "success" },
  refund: { label: "Reembolso", variant: "neutral" },
  adjustment: { label: "Ajuste", variant: "warning" },
};

function Amount({ cents }: { cents: number }) {
  return (
    <span className={clsx("font-display font-semibold tabular-nums whitespace-nowrap", cents > 0 ? "text-success" : "text-fg")}>
      {cents > 0 ? "+" : cents < 0 ? "−" : ""}
      {formatMxn(Math.abs(cents))}
    </span>
  );
}

export default async function AdminLedgerPage({ searchParams }: PageProps<"/admin/movimientos">) {
  await requireAdmin();
  const sp = await searchParams;
  const k = param(sp.kind);
  const kind = KINDS.some((x) => x.value === k) ? k : "all";
  const rows = await listLedger({ kind, limit: 200 });
  const inflow = rows.reduce((a, r) => a + Math.max(0, r.entry.amountCents), 0);
  const outflow = rows.reduce((a, r) => a + Math.min(0, r.entry.amountCents), 0);

  return (
    <div className="flex flex-col gap-6 pb-12">
      <AdminHeader
        title="Movimientos"
        description={
          <>
            Últimos <span className="tabular-nums">{rows.length}</span> movimientos de saldo ·{" "}
            <span className="text-success tabular-nums">+{formatMxn(inflow)}</span> /{" "}
            <span className="tabular-nums">−{formatMxn(Math.abs(outflow))}</span>
          </>
        }
      />

      <FilterChips label="Filtrar por tipo" chips={KINDS} current={kind} hrefFor={(v) => hrefWith("/admin/movimientos", { kind: v })} />

      {rows.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight />} title="Sin movimientos" description="No hay movimientos de este tipo." />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Usuario</th>
                  <th className={th}>Tipo</th>
                  <th className={th}>Descripción</th>
                  <th className={`${th} text-right`}>Monto</th>
                  <th className={`${th} text-right`}>Saldo después</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ entry: e, email }) => {
                  const kb = KIND_BADGE[e.kind] ?? KIND_BADGE.adjustment;
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(e.createdAt)}</td>
                      <td className={`${td} max-w-56`}>
                        <UserLink id={e.userId} email={email} />
                      </td>
                      <td className={td}>
                        <Badge variant={kb.variant}>{kb.label}</Badge>
                      </td>
                      <td className={`${td} max-w-80 truncate text-fg`} title={e.description}>
                        {e.description}
                      </td>
                      <td className={`${td} text-right`}>
                        <Amount cents={e.amountCents} />
                      </td>
                      <td className={`${td} text-right font-display text-muted tabular-nums`}>{formatMxn(e.balanceAfterCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {rows.map(({ entry: e, email }) => {
              const kb = KIND_BADGE[e.kind] ?? KIND_BADGE.adjustment;
              return (
                <li key={e.id} className="flex flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-fg">{e.description}</span>
                    <Amount cents={e.amountCents} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[12px] text-subtle">
                    <UserLink id={e.userId} email={email} />
                    <Badge variant={kb.variant}>{kb.label}</Badge>
                  </div>
                  <p className="flex justify-between text-[12px] text-subtle">
                    <span>{formatDateTime(e.createdAt)}</span>
                    <span className="tabular-nums">Saldo {formatMxn(e.balanceAfterCents)}</span>
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

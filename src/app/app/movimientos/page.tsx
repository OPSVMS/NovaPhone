import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLedger } from "@/lib/queries";
import { formatMxn } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { LedgerRow } from "@/components/app/ledger-row";
import { formatDate } from "@/components/app/format";

export const metadata: Metadata = { title: "Movimientos" };

export default async function LedgerPage() {
  const user = await requireUser();
  const entries = await getLedger(user.id, 200);

  // Group by day (Mexico City).
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = formatDate(e.createdAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title="Movimientos"
        description="Depósitos, compras y reembolsos de tu saldo."
        action={
          <div className="text-left sm:text-right">
            <p className="text-[13px] text-muted">Saldo actual</p>
            <p className="font-display text-2xl font-semibold text-fg tabular-nums">{formatMxn(user.balanceCents)}</p>
          </div>
        }
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight />}
          title="Sin movimientos todavía"
          description="Cuando agregues saldo o compres un plan, lo verás aquí."
          action={<Button href="/app/fondos">Agregar saldo</Button>}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} aria-label={day} className="flex flex-col gap-2">
              <h2 className="px-1 font-sans text-[13px] font-medium capitalize text-subtle">{day}</h2>
              <Card className="px-4 sm:px-5">
                <ul className="divide-y divide-border">
                  {list.map((e) => (
                    <LedgerRow key={e.id} entry={e} timeOnly />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

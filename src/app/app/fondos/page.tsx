import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Landmark, ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { CopyField } from "@/components/app/copy-field";
import { requireUser } from "@/lib/session";
import { getUserDeposits, MAX_DEPOSIT_MXN, MIN_DEPOSIT_MXN } from "@/lib/deposits";
import { formatMxn } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { PageHeader } from "@/components/app/page-header";
import { DepositForm } from "@/components/app/deposit-form";
import { DepositStatusBadge, methodLabel } from "@/components/app/status-badges";
import { formatDateTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Agregar fondos" };

export default async function FundsPage({ searchParams }: PageProps<"/app/fondos">) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const [deposits, account] = await Promise.all([
    getUserDeposits(user.id),
    db.query.users.findFirst({ where: eq(schema.users.id, user.id), columns: { clabe: true } }),
  ]);

  const monto = Number(typeof sp.monto === "string" ? sp.monto : NaN);
  const defaultAmount =
    Number.isFinite(monto) && monto > 0 ? Math.min(MAX_DEPOSIT_MXN, Math.max(MIN_DEPOSIT_MXN, Math.ceil(monto))) : undefined;
  const defaultMethod = sp.metodo === "usdt" ? "usdt" : "spei";

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <PageHeader
        title="Agregar fondos"
        description="Recarga tu saldo y úsalo para comprar planes al instante."
      />

      {account?.clabe ? (
        <FadeIn immediate>
          <Card className="flex flex-col gap-4 p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-lavender">
                <Landmark aria-hidden className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-fg">Tu CLABE personal</h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  Transfiere cualquier monto a esta CLABE y se suma a tu saldo automáticamente, sin referencia. Puedes
                  programar una transferencia mensual en tu banco y activar la auto-recarga en tu eSIM para nunca quedarte sin datos.
                </p>
              </div>
            </div>
            <CopyField label="CLABE" value={account.clabe} copyLabel="Copiar CLABE" />
          </Card>
        </FadeIn>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <FadeIn immediate>
          <Card className="p-5 sm:p-7">
            <DepositForm
              defaultAmount={defaultAmount}
              defaultMethod={defaultMethod}
              min={MIN_DEPOSIT_MXN}
              max={MAX_DEPOSIT_MXN}
            />
          </Card>
        </FadeIn>
        <aside className="flex flex-col gap-3 rounded-card border border-border bg-surface/50 p-5 text-[13px] leading-relaxed text-muted">
          <p className="flex items-center gap-2 font-medium text-fg">
            <ShieldCheck aria-hidden className="size-4 text-lavender" /> Cómo funciona
          </p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 marker:text-subtle">
            <li>Elige método y monto.</li>
            <li>Te damos los datos exactos para pagar.</li>
            <li>Tu saldo se acredita en cuanto confirmamos el pago.</li>
          </ol>
          {defaultAmount ? (
            <p className="text-subtle">Te sugerimos {formatMxn(defaultAmount * 100)} para completar tu compra.</p>
          ) : null}
        </aside>
      </div>

      <section aria-labelledby="history" className="flex flex-col gap-3">
        <h2 id="history" className="text-lg font-semibold text-fg">
          Historial de depósitos
        </h2>
        {deposits.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">
            Aún no tienes depósitos. Tu primer depósito aparecerá aquí.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {deposits.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/app/fondos/${d.id}`}
                    className="flex min-h-16 items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-display text-[15px] font-semibold text-fg tabular-nums">
                        {formatMxn(d.amountCents)}
                      </span>
                      <span className="truncate text-[13px] text-subtle">
                        {methodLabel(d.method)} · {formatDateTime(d.createdAt)}
                      </span>
                    </div>
                    <DepositStatusBadge status={d.status} />
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

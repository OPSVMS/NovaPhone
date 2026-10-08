import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { getUserDeposits, MAX_DEPOSIT_MXN, MIN_DEPOSIT_MXN } from "@/lib/deposits";
import { ensureClabe } from "@/lib/novacore";
import { openpayEnabled } from "@/lib/openpay";
import { formatMxn } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { PageHeader } from "@/components/app/page-header";
import { FundsMethods, type FundsMethod } from "@/components/app/funds-methods";
import type { CardFeeConfig } from "@/components/app/card-fee";
import { DepositStatusBadge, methodLabel } from "@/components/app/status-badges";
import { formatDateTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Agregar fondos" };

const CARD_MAX_MXN = 20_000;

/** Misma configuración que `cardFeeCents` en src/lib/openpay.ts. */
const cardFeeConfig = (): CardFeeConfig => ({
  pct: Number(process.env.OPENPAY_FEE_PCT ?? 2.9),
  fixedMxn: Number(process.env.OPENPAY_FEE_FIXED ?? 2.5),
  pass: process.env.OPENPAY_PASS_FEES !== "false",
});

/** CLABE personal; la asigna en NOVACORE la primera vez (si está configurado). */
async function personalClabe(user: { id: string; name: string; email: string }) {
  const account = await db.query.users.findFirst({ where: eq(schema.users.id, user.id), columns: { clabe: true } });
  if (account?.clabe) return account.clabe;
  try {
    // No bloquear la página si NOVACORE tarda: se reintenta en la siguiente visita.
    return await Promise.race([
      ensureClabe({ ...user, clabe: null }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6_000)),
    ]);
  } catch (e) {
    console.error("ensureClabe", e);
    return null;
  }
}

function parseMethod(v: unknown): FundsMethod {
  if (v === "usdt") return "usdt";
  if (v === "card" || v === "tarjeta") return "card";
  return "spei";
}

export default async function FundsPage({ searchParams }: PageProps<"/app/fondos">) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const [deposits, clabe] = await Promise.all([getUserDeposits(user.id), personalClabe(user)]);

  const monto = Number(typeof sp.monto === "string" ? sp.monto : NaN);
  const defaultAmount =
    Number.isFinite(monto) && monto > 0 ? Math.min(MAX_DEPOSIT_MXN, Math.max(MIN_DEPOSIT_MXN, Math.ceil(monto))) : undefined;

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <PageHeader
        title="Agregar fondos"
        description={
          defaultAmount
            ? `Te sugerimos agregar ${formatMxn(defaultAmount * 100)} para completar tu compra.`
            : "Recarga tu saldo y úsalo para comprar planes al instante."
        }
      />

      <FadeIn immediate>
        <Card className="p-5 sm:p-7">
          <FundsMethods
            initialMethod={parseMethod(sp.metodo)}
            clabe={clabe}
            beneficiary={process.env.SPEI_BENEFICIARY || "MACAIBA COMMERCE"}
            cardEnabled={openpayEnabled()}
            fee={cardFeeConfig()}
            defaultAmount={defaultAmount}
            min={MIN_DEPOSIT_MXN}
            max={MAX_DEPOSIT_MXN}
            cardMax={CARD_MAX_MXN}
          />
        </Card>
      </FadeIn>

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

import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeftRight, ArrowRight, Check, CardSim, Plus, ShoppingBag, Wallet } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getUserOrders } from "@/lib/orders";
import { getActivePlans } from "@/lib/catalog";
import { getLedger } from "@/lib/queries";
import { formatMxn } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { EsimSummaryCard } from "@/components/app/esim-summary-card";
import { LedgerRow } from "@/components/app/ledger-row";
import { daysLeft, firstName, greeting } from "@/components/app/format";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [orders, ledger, plans] = await Promise.all([getUserOrders(user.id), getLedger(user.id, 5), getActivePlans()]);
  const now = new Date().getTime();

  const active = orders
    .filter((o) => o.status === "provisioning" || (o.status === "ready" && daysLeft(o.expiresAt, now) !== 0))
    .slice(0, 4);
  const cheapest = plans.reduce<number | null>((min, p) => (min === null || p.priceMxn < min ? p.priceMxn : min), null);
  const hasBalance = user.balanceCents > 0;
  const canBuy = cheapest !== null && user.balanceCents >= cheapest * 100;
  const isNew = orders.length === 0;

  const steps = [
    { title: "Agrega saldo", desc: "Con SPEI o USDT, desde $100.", done: hasBalance || ledger.length > 0, href: "/app/fondos" },
    { title: "Compra tu primer plan", desc: "Elige cuántos GB necesitas.", done: !isNew, href: "/app/comprar" },
    { title: "Instala tu eSIM", desc: "Escanea el QR y listo.", done: false, href: "/app/esims" },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <FadeIn immediate y={8}>
        <p className="text-[15px] text-muted">{greeting()},</p>
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{firstName(user.name)}</h1>
      </FadeIn>

      {/* Balance hero */}
      <FadeIn immediate delay={0.06}>
        <section
          aria-label="Saldo"
          className="border-gradient glow noise relative overflow-hidden rounded-panel p-6 sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgb(118_82_240/0.35),transparent)]"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 text-sm text-muted">
                <Wallet aria-hidden className="size-4 text-lavender" />
                Saldo disponible
              </span>
              <p className="font-display text-5xl font-semibold tracking-tight text-fg tabular-nums sm:text-6xl">
                {formatMxn(user.balanceCents)}
              </p>
              <p className="text-[13px] text-subtle">MXN · Úsalo para comprar planes al instante</p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button href="/app/fondos" size="lg" className="w-full sm:w-auto">
                <Plus aria-hidden /> Agregar saldo
              </Button>
              <Button href="/app/comprar" size="lg" variant="secondary" className="w-full sm:w-auto">
                <ShoppingBag aria-hidden /> Comprar plan
              </Button>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Onboarding */}
      {isNew ? (
        <section aria-labelledby="onboarding" className="flex flex-col gap-4">
          <div>
            <h2 id="onboarding" className="text-lg font-semibold text-fg">
              Empieza en 3 pasos
            </h2>
            <p className="text-sm text-muted">
              {canBuy
                ? "Ya tienes saldo. Elige tu plan y tendrás datos en minutos."
                : "Agrega saldo y compra tu primer plan. Todo desde aquí."}
            </p>
          </div>
          <Stagger as="ol" immediate className="grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => {
              const isCurrent = i === current;
              return (
                <StaggerItem as="li" key={s.title}>
                  <Link
                    href={s.href}
                    className={clsx(
                      "flex h-full items-start gap-3 rounded-card border p-4 transition-colors duration-200",
                      isCurrent
                        ? "border-lavender/30 bg-primary/[0.08] hover:bg-primary/[0.12]"
                        : "border-border bg-surface/70 hover:border-border-strong hover:bg-surface-2",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border font-display text-[13px] font-semibold tabular-nums",
                        s.done
                          ? "border-success/30 bg-success/10 text-success"
                          : isCurrent
                            ? "border-lavender/40 bg-primary text-primary-foreground"
                            : "border-border-strong text-muted",
                      )}
                    >
                      {s.done ? <Check aria-hidden className="size-3.5" /> : i + 1}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={clsx("text-[15px] font-medium", s.done ? "text-muted line-through decoration-subtle" : "text-fg")}>
                        {s.title}
                      </span>
                      <span className="text-[13px] text-subtle">{s.desc}</span>
                      {s.done ? <span className="sr-only">(completado)</span> : null}
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      ) : (
        <nav aria-label="Accesos rápidos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/app/comprar", label: "Comprar plan", icon: ShoppingBag },
            { href: "/app/fondos", label: "Agregar saldo", icon: Plus },
            { href: "/app/esims", label: "Mis eSIM", icon: CardSim },
            { href: "/app/movimientos", label: "Movimientos", icon: ArrowLeftRight },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 items-center gap-3 rounded-card border border-border bg-surface/70 px-4 py-3.5 text-sm font-medium text-fg transition-colors duration-200 hover:border-border-strong hover:bg-surface-2"
            >
              <Icon aria-hidden className="size-[18px] text-lavender" />
              {label}
            </Link>
          ))}
        </nav>
      )}

      {/* Active eSIMs */}
      {active.length > 0 ? (
        <section aria-labelledby="active-esims" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="active-esims" className="text-lg font-semibold text-fg">
              Tus eSIM activas
            </h2>
            <Link href="/app/esims" className="inline-flex items-center gap-1 text-sm text-lavender hover:text-lavender-soft">
              Ver todas <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          <Stagger immediate delay={0.1} className="grid gap-4 sm:grid-cols-2">
            {active.map((o) => (
              <StaggerItem key={o.id}>
                <EsimSummaryCard order={o} now={now} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ) : null}

      {/* Recent activity */}
      {ledger.length > 0 ? (
        <section aria-labelledby="recent" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id="recent" className="text-lg font-semibold text-fg">
              Actividad reciente
            </h2>
            <Link href="/app/movimientos" className="inline-flex items-center gap-1 text-sm text-lavender hover:text-lavender-soft">
              Ver todo <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          <Card className="px-5">
            <ul className="divide-y divide-border">
              {ledger.map((e) => (
                <LedgerRow key={e.id} entry={e} showBalance={false} />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

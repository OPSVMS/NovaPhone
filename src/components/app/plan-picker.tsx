"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Globe, Plus, Signal, Smartphone, Sparkles, Zap } from "lucide-react";
import { buyPlan } from "@/app/actions/wallet";
import type { FormState } from "@/app/actions/auth";
import { formatGb, formatMxn } from "@/lib/pricing";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { topUpAmountMxn } from "./format";

export type PickerPlan = {
  id: string;
  dataGb: number;
  days: number;
  priceMxn: number;
  featured: boolean;
  speed: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function PlanPicker({
  plans,
  balanceCents,
  initialPlanId,
}: {
  plans: PickerPlan[];
  balanceCents: number;
  initialPlanId?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialPlanId ?? plans[0]?.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(buyPlan, undefined);

  const plan = plans.find((p) => p.id === selectedId) ?? plans[0];
  if (!plan) return null;

  const priceCents = plan.priceMxn * 100;
  const missing = Math.max(0, priceCents - balanceCents);
  const enough = missing === 0;
  const topUp = topUpAmountMxn(missing);
  const topUpHref = `/app/fondos?monto=${topUp}`;

  const summary = (
    <dl className="flex flex-col text-sm">
      <div className="flex items-center justify-between gap-4 py-2.5">
        <dt className="text-muted">Plan</dt>
        <dd className="font-medium text-fg tabular-nums">
          {formatGb(plan.dataGb)} · {plan.days} días
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 py-2.5">
        <dt className="text-muted">Precio</dt>
        <dd className="font-display font-semibold text-fg tabular-nums">{formatMxn(priceCents)}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 py-2.5">
        <dt className="text-muted">Tu saldo</dt>
        <dd className="text-fg tabular-nums">{formatMxn(balanceCents)}</dd>
      </div>
      <div className="hairline my-1" />
      <div className="flex items-center justify-between gap-4 py-2.5">
        <dt className="text-muted">{enough ? "Saldo después" : "Te faltan"}</dt>
        <dd
          className={clsx(
            "font-display text-base font-semibold tabular-nums",
            enough ? "text-fg" : "text-warning",
          )}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={enough ? `a-${balanceCents - priceCents}` : `m-${missing}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="inline-block"
            >
              {formatMxn(enough ? balanceCents - priceCents : missing)}
            </motion.span>
          </AnimatePresence>
        </dd>
      </div>
    </dl>
  );

  const cta = enough ? (
    <Button size="lg" fullWidth onClick={() => setConfirmOpen(true)}>
      Comprar por {formatMxn(priceCents)} <ArrowRight aria-hidden />
    </Button>
  ) : (
    <Button href={topUpHref} size="lg" fullWidth>
      <Plus aria-hidden /> Agregar {formatMxn(topUp * 100)}
    </Button>
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <input type="hidden" name="planId" value={plan.id} />

      {/* Plans */}
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="sr-only">Elige un plan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p, i) => {
            const selected = p.id === plan.id;
            return (
              <motion.label
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 6) * 0.05 }}
                className={clsx(
                  "relative flex cursor-pointer flex-col gap-4 rounded-card p-5 transition-[border-color,background-color,box-shadow] duration-200 ease-out-expo",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lavender",
                  selected
                    ? "border border-lavender/50 bg-primary/[0.09] shadow-glow-sm"
                    : p.featured
                      ? "border-gradient shadow-card hover:bg-surface-2"
                      : "border border-border bg-surface/80 shadow-card hover:border-border-strong hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="plan-choice"
                  value={p.id}
                  checked={selected}
                  onChange={() => setSelectedId(p.id)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="whitespace-nowrap font-display text-3xl font-semibold tracking-tight text-fg tabular-nums">
                      {formatGb(p.dataGb)}
                    </span>
                    <span className="text-sm text-muted tabular-nums">{p.days} días</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {p.featured ? (
                      <Badge variant="primary">
                        <Sparkles aria-hidden className="size-3" /> Más popular
                      </Badge>
                    ) : null}
                    <span
                      aria-hidden
                      className={clsx(
                        "flex size-6 items-center justify-center rounded-full border transition-colors duration-200",
                        selected ? "border-lavender bg-primary text-primary-foreground" : "border-border-strong",
                      )}
                    >
                      {selected ? <Check className="size-3.5" /> : null}
                    </span>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <span className="text-[13px] text-subtle">Telcel {p.speed?.includes("5G") ? "5G" : "4G/5G"}</span>
                  <span className="font-display text-xl font-semibold text-fg tabular-nums">
                    {formatMxn(p.priceMxn * 100)}
                  </span>
                </div>
              </motion.label>
            );
          })}
        </div>
        <p className="px-1 text-[13px] text-subtle">
          Precios en MXN. Se paga con tu saldo, sin cargos extra ni contratos.
        </p>
      </fieldset>

      {/* Summary (desktop sticky / mobile inline) */}
      <aside aria-label="Resumen" className="lg:sticky lg:top-12">
        <div className="rounded-card border border-border bg-surface/90 p-5 shadow-card backdrop-blur sm:p-6">
          <h2 className="text-base font-semibold text-fg">Resumen</h2>
          <div className="mt-2">{summary}</div>
          {!enough ? (
            <Alert variant="warning" className="mt-3" title={`Te faltan ${formatMxn(missing)}`}>
              Agrega saldo con SPEI o USDT y regresa a terminar tu compra.
            </Alert>
          ) : null}
          {state?.error ? (
            <Alert variant="error" className="mt-3">
              {state.error}
            </Alert>
          ) : null}
          <div className="mt-4 hidden lg:block">{cta}</div>
          <ul className="mt-5 flex flex-col gap-2 text-[13px] text-muted">
            <li className="flex items-center gap-2">
              <Zap aria-hidden className="size-3.5 text-lavender" /> Entrega inmediata del QR
            </li>
            <li className="flex items-center gap-2">
              <Signal aria-hidden className="size-3.5 text-lavender" /> Red Telcel 5G en todo México
            </li>
          </ul>
        </div>
      </aside>

      {/* Mobile sticky CTA above the tab bar */}
      <div className="glass-strong fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-x-0 px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] text-muted tabular-nums">
              {formatGb(plan.dataGb)} · {plan.days} días
            </span>
            <span className="font-display text-lg font-semibold text-fg tabular-nums">{formatMxn(priceCents)}</span>
          </div>
          <div className="ml-auto">
            {enough ? (
              <Button onClick={() => setConfirmOpen(true)}>
                Comprar <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button href={topUpHref}>
                <Plus aria-hidden /> Agregar {formatMxn(topUp * 100)}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div aria-hidden className="h-16 lg:hidden" />

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirma tu compra"
        description={`Se descontarán ${formatMxn(priceCents)} de tu saldo.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingText="Generando tu eSIM…">Pagar {formatMxn(priceCents)}</SubmitButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface-2/60 px-4">{summary}</div>
          <ul className="flex flex-col gap-3 text-sm">
            {[
              { icon: Globe, title: "eSIM solo de datos", desc: "No incluye número, llamadas ni SMS. Usa WhatsApp y apps normalmente." },
              { icon: Signal, title: "Red Telcel 5G", desc: "Cobertura en todo México (4G/5G según tu zona)." },
              { icon: Zap, title: "Activa “Roaming de datos”", desc: "En la eSIM, para que se conecte a la red." },
              { icon: Smartphone, title: "Requiere teléfono compatible", desc: "Con eSIM y liberado (desbloqueado)." },
            ].map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-lavender">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-fg">{title}</span>
                  <span className="text-[13px] leading-relaxed text-muted">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
          {state?.error ? <Alert variant="error">{state.error}</Alert> : null}
        </div>
      </Dialog>
    </form>
  );
}

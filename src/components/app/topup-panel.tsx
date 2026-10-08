"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { Check, RefreshCcw, Repeat } from "lucide-react";
import { topupAction, autoTopupAction } from "@/app/actions/esim";
import type { FormState } from "@/app/actions/auth";
import type { TopupOption } from "@/lib/topups";
import { formatGb, formatMxn } from "@/lib/pricing";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  orderId: string;
  options: TopupOption[];
  autoPlanId: string | null;
  balanceCents: number;
};

export function TopupPanel({ orderId, options, autoPlanId, balanceCents }: Props) {
  const [selectedId, setSelectedId] = useState(options.find((o) => o.planId === autoPlanId)?.planId ?? options.at(-2)?.planId ?? options[0]?.planId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await topupAction(prev, fd);
    if (res?.ok) setConfirmOpen(false);
    return res;
  }, undefined);
  const [autoState, autoAction] = useActionState<FormState, FormData>(autoTopupAction, undefined);

  const selected = options.find((o) => o.planId === selectedId);
  if (!selected) return null;
  const priceCents = selected.priceMxn * 100;
  const enough = balanceCents >= priceCents;
  const missing = Math.ceil((priceCents - balanceCents) / 10_000) * 100;
  const autoPlan = options.find((o) => o.planId === autoPlanId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCcw aria-hidden className="size-4 text-lavender" /> Recargar esta eSIM
        </CardTitle>
        <CardDescription>Suma datos y días a la misma eSIM. No tienes que reinstalar nada.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <fieldset className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <legend className="sr-only">Elige una recarga</legend>
          {options.map((o) => {
            const on = o.planId === selectedId;
            return (
              <label
                key={o.planId}
                className={clsx(
                  "relative flex cursor-pointer flex-col gap-1 rounded-control border p-3.5 transition-colors duration-200",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lavender",
                  on ? "border-lavender/50 bg-primary/[0.09]" : "border-border bg-surface-2/50 hover:border-border-strong",
                )}
              >
                <input type="radio" name="topup-choice" value={o.planId} checked={on} onChange={() => setSelectedId(o.planId)} className="sr-only" />
                <span className="whitespace-nowrap font-display text-lg font-semibold text-fg tabular-nums">{formatGb(o.dataGb)}</span>
                <span className="text-[13px] text-muted tabular-nums">+{o.days} días</span>
                <span className="mt-1 font-medium text-fg tabular-nums">{formatMxn(o.priceMxn * 100)}</span>
                {o.planId === autoPlanId ? (
                  <span className="absolute right-2.5 top-2.5 text-lavender" title="Auto-recarga">
                    <Repeat aria-label="Auto-recarga" className="size-3.5" />
                  </span>
                ) : null}
              </label>
            );
          })}
        </fieldset>

        {state?.ok ? <Alert variant="success">{state.ok}</Alert> : null}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {enough ? (
            <Button onClick={() => setConfirmOpen(true)} className="w-full sm:w-auto">
              Recargar {formatGb(selected.dataGb)} por {formatMxn(priceCents)}
            </Button>
          ) : (
            <Button href={`/app/fondos?monto=${Math.max(100, missing)}`} className="w-full sm:w-auto">
              Agrega {formatMxn(Math.max(100, missing) * 100)} para recargar
            </Button>
          )}
          <span className="text-center text-[13px] text-subtle sm:text-left">Tu saldo: {formatMxn(balanceCents)}</span>
        </div>

        {/* Auto-recarga */}
        <form action={autoAction} className="flex flex-col gap-3 rounded-control border border-border bg-surface-2/40 p-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="planId" value={autoPlan ? "" : selected.planId} />
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-lavender">
              <Repeat aria-hidden className="size-4" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-fg">
                Auto-recarga {autoPlan ? <span className="text-success">activa</span> : <span className="text-muted">apagada</span>}
              </p>
              <p className="text-[13px] leading-relaxed text-muted">
                {autoPlan
                  ? `Cuando te queden menos de 500 MB o 2 días, recargamos ${formatGb(autoPlan.dataGb)} por ${formatMxn(autoPlan.priceMxn * 100)} con tu saldo y te avisamos por correo.`
                  : `Activa la recarga automática de ${formatGb(selected.dataGb)} (${formatMxn(priceCents)}) para no quedarte sin datos. Se paga con tu saldo.`}
              </p>
            </div>
          </div>
          {autoState?.error ? <Alert variant="error">{autoState.error}</Alert> : null}
          <SubmitButton variant={autoPlan ? "secondary" : "primary"} size="sm" className="self-start" pendingText="Guardando…">
            {autoPlan ? "Desactivar auto-recarga" : `Activar auto-recarga de ${formatGb(selected.dataGb)}`}
          </SubmitButton>
        </form>
      </CardContent>

      <form action={action}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="planId" value={selected.planId} />
        <Dialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          size="sm"
          title="Confirma tu recarga"
          description={`Se descontarán ${formatMxn(priceCents)} de tu saldo.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <SubmitButton pendingText="Recargando…">Pagar {formatMxn(priceCents)}</SubmitButton>
            </>
          }
        >
          <ul className="flex flex-col gap-2 text-sm text-muted">
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-4 text-lavender" /> Se suman {formatGb(selected.dataGb)} y {selected.days} días a esta eSIM.
            </li>
            <li className="flex gap-2">
              <Check aria-hidden className="mt-0.5 size-4 text-lavender" /> Se aplica al instante, sin reinstalar.
            </li>
          </ul>
          {state?.error ? <Alert variant="error" className="mt-4">{state.error}</Alert> : null}
        </Dialog>
      </form>
    </Card>
  );
}

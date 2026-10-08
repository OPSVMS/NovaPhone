"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, Link2, PackageOpen, Repeat } from "lucide-react";
import { autoRenewAction, buyNumberAction, linkEsimAction } from "@/app/actions/numbers";
import type { FormState } from "@/app/actions/auth";
import { formatMxn } from "@/lib/pricing";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export type EsimOption = { id: string; label: string };

function EsimSelect({ id, esims, defaultValue }: { id: string; esims: EsimOption[]; defaultValue?: string }) {
  return (
    <Select id={id} name="orderId" defaultValue={defaultValue ?? ""}>
      <option value="">Sin ligar a una eSIM</option>
      {esims.map((e) => (
        <option key={e.id} value={e.id}>
          {e.label}
        </option>
      ))}
    </Select>
  );
}

/** Compra del número (sin número asignado). */
export function NumberBuy({
  priceCents,
  balanceCents,
  esims,
  soldOut,
  topUpMxn,
}: {
  priceCents: number;
  balanceCents: number;
  esims: EsimOption[];
  soldOut: boolean;
  /** Monto sugerido para /app/fondos si no alcanza el saldo. */
  topUpMxn: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await buyNumberAction(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, undefined);
  const selectId = useId();
  const enough = balanceCents >= priceCents;
  const price = formatMxn(priceCents);

  if (soldOut) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border-strong p-5">
        <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-lavender">
          <PackageOpen aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium text-fg">Agotado por ahora</p>
          <p className="text-sm leading-relaxed text-muted">
            Estamos agregando más números. Vuelve en unos días; no se te cobra nada mientras tanto.
          </p>
        </div>
        <Button disabled className="w-full sm:w-auto">
          Agotado
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {esims.length ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={selectId} optional>
            Ligar a una eSIM
          </Label>
          <EsimSelect id={selectId} esims={esims} defaultValue={esims.length === 1 ? esims[0].id : ""} />
          <p className="text-[13px] text-subtle">Solo para tu referencia: así sabes qué número usas con cada eSIM.</p>
        </div>
      ) : null}

      {state?.ok ? <Alert variant="success">{state.ok}</Alert> : null}
      {state?.error && !open ? <Alert variant="error">{state.error}</Alert> : null}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {enough ? (
          <Button size="lg" onClick={() => setOpen(true)} className="w-full sm:w-auto">
            Obtener mi número por {price}/mes
          </Button>
        ) : (
          <Button href={`/app/fondos?monto=${topUpMxn}`} size="lg" className="w-full sm:w-auto">
            Agrega {formatMxn(topUpMxn * 100)} para continuar
          </Button>
        )}
        <span className="text-center text-[13px] text-subtle sm:text-left">Tu saldo: {formatMxn(balanceCents)}</span>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title="Confirma tu número"
        description={`Se descontarán ${price} de tu saldo hoy y cada 30 días mientras lo conserves.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingText="Asignando…">Pagar {price}</SubmitButton>
          </>
        }
      >
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li className="flex gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" /> Recibe SMS al instante aquí y en tu correo.
          </li>
          <li className="flex gap-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" /> Puedes desactivar la renovación cuando quieras.
          </li>
        </ul>
        {state?.error ? (
          <Alert variant="error" className="mt-4">
            {state.error}
          </Alert>
        ) : null}
      </Dialog>
    </form>
  );
}

/** Ajustes del número: renovación automática y eSIM ligada. */
export function NumberSettings({
  autoRenew,
  renewsLabel,
  priceLabel,
  esims,
  linkedOrderId,
}: {
  autoRenew: boolean;
  renewsLabel: string;
  priceLabel: string;
  esims: EsimOption[];
  linkedOrderId: string | null;
}) {
  const [renewState, renewAction, renewPending] = useActionState<FormState, FormData>(autoRenewAction, undefined);
  const [linkState, linkAction] = useActionState<FormState, FormData>(linkEsimAction, undefined);
  const selectId = useId();
  const switchLabelId = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajustes</CardTitle>
        <CardDescription>Renovación y eSIM ligada.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={renewAction} className="flex flex-col gap-3">
          <input type="hidden" name="autoRenew" value={autoRenew ? "0" : "1"} />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-lavender">
                <Repeat aria-hidden className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <p id={switchLabelId} className="font-medium text-fg">
                  Renovación automática
                </p>
                <p className="text-[13px] leading-relaxed text-muted">
                  {autoRenew
                    ? `Se renueva el ${renewsLabel} por ${priceLabel} con tu saldo.`
                    : `Conservas el número hasta el ${renewsLabel}. Después se libera y no podrás recuperarlo.`}
                </p>
              </div>
            </div>
            <button
              type="submit"
              role="switch"
              aria-checked={autoRenew}
              aria-labelledby={switchLabelId}
              disabled={renewPending}
              className={clsx(
                "relative inline-flex h-11 w-[60px] shrink-0 items-center rounded-full p-1.5 transition-colors duration-200 disabled:opacity-60",
                "before:absolute before:inset-y-1.5 before:inset-x-1 before:rounded-full before:transition-colors before:duration-200",
                autoRenew ? "before:bg-primary" : "before:bg-surface-3 before:ring-1 before:ring-border-strong",
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  "relative size-6 rounded-full bg-fg shadow-card transition-transform duration-200 ease-out-expo motion-reduce:transition-none",
                  autoRenew ? "translate-x-[22px]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          {renewState?.ok ? <Alert variant="success">{renewState.ok}</Alert> : null}
          {renewState?.error ? <Alert variant="error">{renewState.error}</Alert> : null}
        </form>

        <div className="hairline" />

        <form action={linkAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={selectId} className="flex items-center gap-2">
              <Link2 aria-hidden className="size-4 text-lavender" /> eSIM ligada
            </Label>
            {esims.length ? (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="min-w-0 flex-1">
                  <EsimSelect id={selectId} esims={esims} defaultValue={linkedOrderId ?? ""} />
                </div>
                <SubmitButton variant="secondary" className="w-full sm:w-auto" pendingText="Guardando…">
                  Guardar
                </SubmitButton>
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed text-muted">
                Aún no tienes eSIMs activas.{" "}
                <Link href="/app/comprar" className="text-lavender underline-offset-4 hover:underline">
                  Compra un plan
                </Link>{" "}
                y úsalo junto con tu número.
              </p>
            )}
            <p className="text-[13px] text-subtle">
              Es solo una referencia; el número recibe SMS aunque no esté ligado ni tengas la eSIM encendida.
            </p>
          </div>
          {linkState?.ok ? <Alert variant="success">{linkState.ok}</Alert> : null}
          {linkState?.error ? <Alert variant="error">{linkState.error}</Alert> : null}
        </form>
      </CardContent>
    </Card>
  );
}

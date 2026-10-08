"use client";

import { useActionState, useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { payWithCard } from "@/app/actions/wallet";
import type { FormState } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { AmountField, amountError, fmtMxn0 } from "./deposit-form";
import { cardFeeCents, type CardFeeConfig } from "./card-fee";

const fmt2 = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

export function CardDepositForm({
  enabled,
  fee,
  defaultAmount,
  min,
  max,
}: {
  enabled: boolean;
  fee: CardFeeConfig;
  defaultAmount?: number;
  min: number;
  max: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(payWithCard, undefined);
  const [amount, setAmount] = useState(defaultAmount ? String(Math.min(defaultAmount, max)) : "");
  const [touched, setTouched] = useState(false);

  const value = Number(amount);
  const localError = amountError(amount, min, max);
  const shownError = (touched && localError) || state?.error || null;
  const feeCents = localError ? 0 : cardFeeCents(value * 100, fee);
  const totalCents = value * 100 + feeCents;

  if (!enabled) {
    return (
      <div className="flex flex-col items-center gap-4 px-2 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-lavender">
          <CreditCard aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col items-center gap-2">
          <Badge variant="primary">Muy pronto</Badge>
          <h3 className="text-lg font-semibold text-fg">Pago con tarjeta</h3>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted">
            Muy pronto podrás recargar con tarjeta de débito o crédito. Mientras tanto, usa SPEI: se acredita en minutos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (localError) {
          e.preventDefault();
          setTouched(true);
        }
      }}
      className="flex flex-col gap-6"
    >
      <AmountField
        label="Monto a agregar a tu saldo"
        amount={amount}
        onAmountChange={(v, chip) => {
          setAmount(v);
          if (chip) setTouched(false);
        }}
        onBlur={() => setTouched(true)}
        error={shownError}
        hint={`Desde ${fmtMxn0(min)} hasta ${fmtMxn0(max)} con tarjeta de débito o crédito.`}
      />

      <div
        aria-live="polite"
        className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-2/60 px-4 py-3.5"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-muted">Pagas</span>
          <span className="font-display text-2xl font-semibold tracking-tight text-fg tabular-nums">
            {localError ? "—" : fmt2(totalCents)}
          </span>
        </div>
        <p className="text-right text-[13px] leading-snug text-subtle">
          {localError
            ? "Escribe un monto para ver el total."
            : feeCents > 0
              ? <>Incluye comisión <span className="text-muted tabular-nums">{fmt2(feeCents)}</span></>
              : "Sin comisión"}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <SubmitButton size="lg" fullWidth pendingText="Abriendo pago seguro…">
          <CreditCard aria-hidden /> Pagar con tarjeta
        </SubmitButton>
        <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-subtle">
          <Lock aria-hidden className="size-3.5 shrink-0" />
          Pago seguro con Openpay (BBVA) · 3D Secure
        </p>
      </div>
      <p className="text-[13px] leading-relaxed text-subtle">
        Te llevamos a la página segura de Openpay para capturar tu tarjeta; NovaPhone nunca ve sus datos. Al terminar regresas
        aquí y tu saldo se acredita al instante.
      </p>
    </form>
  );
}

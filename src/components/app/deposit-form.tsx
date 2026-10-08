"use client";

import { useActionState, useId, useState } from "react";
import clsx from "clsx";
import { Coins, Landmark } from "lucide-react";
import { requestDeposit } from "@/app/actions/wallet";
import type { FormState } from "@/app/actions/auth";
import { controlClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { SubmitButton } from "@/components/ui/submit-button";

const CHIPS = [200, 500, 1000, 2000];
export const fmtMxn0 = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

/** Valida un monto entero en MXN; regresa el mensaje de error o null. */
export function amountError(amount: string, min: number, max: number) {
  const value = Number(amount);
  return !amount
    ? "Escribe un monto"
    : !Number.isInteger(value)
      ? "Usa montos enteros"
      : value < min
        ? `El mínimo es ${fmtMxn0(min)}`
        : value > max
          ? `El máximo es ${fmtMxn0(max)}`
          : null;
}

/** Input grande de monto + chips rápidos. Controlado. */
export function AmountField({
  label = "Monto a agregar",
  amount,
  onAmountChange,
  onBlur,
  error,
  hint,
  chips = CHIPS,
}: {
  label?: string;
  amount: string;
  onAmountChange: (v: string, fromChip: boolean) => void;
  onBlur?: () => void;
  error?: string | null;
  hint: string;
  chips?: number[];
}) {
  const id = useId();
  const value = Number(amount);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-amount`}>{label}</Label>
      <div className="relative flex items-center">
        <span aria-hidden className="pointer-events-none absolute left-4 font-display text-2xl font-semibold text-subtle">
          $
        </span>
        <input
          id={`${id}-amount`}
          name="amount"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="transaction-amount"
          placeholder="0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value.replace(/\D/g, "").slice(0, 6), false)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-amount-desc`}
          className={clsx(controlClass, "h-16 pl-9 pr-16 font-display text-3xl! font-semibold tabular-nums")}
        />
        <span aria-hidden className="pointer-events-none absolute right-4 text-sm font-medium text-muted">
          MXN
        </span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Montos rápidos">
        {chips.map((c) => {
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onAmountChange(String(c), true)}
              aria-pressed={active}
              className={clsx(
                "h-11 flex-1 rounded-full border px-4 text-sm font-medium tabular-nums transition-colors duration-200 sm:flex-none",
                active
                  ? "border-lavender/50 bg-primary/15 text-fg"
                  : "border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {fmtMxn0(c)}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-amount-desc`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-amount-desc`} className="text-[13px] text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}

export function DepositForm({
  defaultAmount,
  defaultMethod = "spei",
  method: fixedMethod,
  min,
  max,
}: {
  defaultAmount?: number;
  defaultMethod?: "spei" | "usdt";
  /** Fija el método (oculta el selector). */
  method?: "spei" | "usdt";
  min: number;
  max: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(requestDeposit, undefined);
  const [pickedMethod, setMethod] = useState<"spei" | "usdt">(defaultMethod);
  const method = fixedMethod ?? pickedMethod;
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [touched, setTouched] = useState(false);

  const value = Number(amount);
  const localError = amountError(amount, min, max);
  const shownError = (touched && localError) || state?.error || null;

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
      {fixedMethod ? (
        <input type="hidden" name="method" value={fixedMethod} />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-fg">Método de pago</span>
          <Segmented<"spei" | "usdt">
            aria-label="Método de pago"
            name="method"
            value={method}
            onValueChange={setMethod}
            fullWidth
            options={[
              { value: "spei", label: "SPEI", icon: <Landmark aria-hidden /> },
              { value: "usdt", label: "USDT", icon: <Coins aria-hidden /> },
            ]}
          />
          <p className="text-[13px] text-subtle">
            {method === "spei"
              ? "Transferencia desde tu banco o app. Se acredita en minutos."
              : "Envía USDT desde tu wallet o exchange. Se acredita tras confirmarse en la red."}
          </p>
        </div>
      )}

      <AmountField
        amount={amount}
        onAmountChange={(v, chip) => {
          setAmount(v);
          if (chip) setTouched(false);
        }}
        onBlur={() => setTouched(true)}
        error={shownError}
        hint={`Desde ${fmtMxn0(min)} hasta ${fmtMxn0(max)}.`}
      />

      <SubmitButton size="lg" fullWidth pendingText="Generando instrucciones…">
        Continuar{!localError ? ` con ${fmtMxn0(value)}` : ""}
      </SubmitButton>
    </form>
  );
}

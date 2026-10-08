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
const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export function DepositForm({
  defaultAmount,
  defaultMethod = "spei",
  min,
  max,
}: {
  defaultAmount?: number;
  defaultMethod?: "spei" | "usdt";
  min: number;
  max: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(requestDeposit, undefined);
  const [method, setMethod] = useState<"spei" | "usdt">(defaultMethod);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [touched, setTouched] = useState(false);
  const id = useId();

  const value = Number(amount);
  const localError = !amount
    ? "Escribe un monto"
    : !Number.isInteger(value)
      ? "Usa montos enteros"
      : value < min
        ? `El mínimo es ${fmt(min)}`
        : value > max
          ? `El máximo es ${fmt(max)}`
          : null;
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
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg">
          Método de pago
        </span>
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-amount`}>Monto a agregar</Label>
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-4 font-display text-2xl font-semibold text-subtle">$</span>
          <input
            id={`${id}-amount`}
            name="amount"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="transaction-amount"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onBlur={() => setTouched(true)}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={`${id}-amount-desc`}
            className={clsx(controlClass, "h-16 pl-9 pr-16 font-display text-3xl! font-semibold tabular-nums")}
          />
          <span className="pointer-events-none absolute right-4 text-sm font-medium text-muted">MXN</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Montos rápidos">
          {CHIPS.map((c) => {
            const active = value === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setAmount(String(c));
                  setTouched(false);
                }}
                aria-pressed={active}
                className={clsx(
                  "h-11 flex-1 rounded-full border px-4 text-sm font-medium tabular-nums transition-colors duration-200 sm:flex-none",
                  active
                    ? "border-lavender/50 bg-primary/15 text-fg"
                    : "border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {fmt(c)}
              </button>
            );
          })}
        </div>
        {shownError ? (
          <p id={`${id}-amount-desc`} role="alert" className="text-[13px] text-danger">
            {shownError}
          </p>
        ) : (
          <p id={`${id}-amount-desc`} className="text-[13px] text-subtle">
            Desde {fmt(min)} hasta {fmt(max)}.
          </p>
        )}
      </div>

      <SubmitButton size="lg" fullWidth pendingText="Generando instrucciones…">
        Continuar{value >= min && value <= max && !localError ? ` con ${fmt(value)}` : ""}
      </SubmitButton>
    </form>
  );
}

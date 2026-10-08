"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ClipboardEvent, type KeyboardEvent, type RefObject } from "react";
import clsx from "clsx";
import { RotateCw } from "lucide-react";
import { resendCode, verifyEmail, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

export const OTP_LENGTH = 6;
const LENGTH = OTP_LENGTH;
const COOLDOWN = 60;

export const emptyOtp = () => Array<string>(LENGTH).fill("");

/** Casillas de código de 6 dígitos (pegar, autocompletar del SO, flechas, borrar). */
export function OtpInput({
  digits,
  onDigitsChange,
  onComplete,
  disabled,
  invalid,
  autoFocus = true,
  label = "Código de verificación",
  inputRefs,
}: {
  digits: string[];
  onDigitsChange: (d: string[]) => void;
  /** Se llama cuando las 6 casillas están llenas. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
  /** Para enfocar desde fuera (p. ej. tras un error). */
  inputRefs?: RefObject<(HTMLInputElement | null)[]>;
}) {
  const ownRefs = useRef<(HTMLInputElement | null)[]>([]);
  const refs = inputRefs ?? ownRefs;

  function focus(i: number) {
    const el = refs.current[Math.max(0, Math.min(LENGTH - 1, i))];
    el?.focus();
    el?.select();
  }

  function fill(from: number, chars: string) {
    const clean = chars.replace(/\D/g, "").slice(0, LENGTH - from);
    if (!clean) return;
    const nextDigits = [...digits];
    for (let k = 0; k < clean.length; k++) nextDigits[from + k] = clean[k];
    onDigitsChange(nextDigits);
    if (!nextDigits.includes("")) {
      refs.current[LENGTH - 1]?.blur();
      onComplete?.(nextDigits.join(""));
    } else {
      focus(from + clean.length);
    }
  }

  function onChange(i: number, value: string) {
    const raw = value.replace(/\D/g, "");
    if (!raw) {
      const nextDigits = [...digits];
      nextDigits[i] = "";
      onDigitsChange(nextDigits);
      return;
    }
    // Typed next to an existing digit: keep only the new one.
    if (raw.length === 2 && digits[i]) return fill(i, raw[0] === digits[i] ? raw[1] : raw[0]);
    // One digit, or the whole code from OS autofill.
    fill(i, raw);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const nextDigits = [...digits];
      nextDigits[i - 1] = "";
      onDigitsChange(nextDigits);
      focus(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fill(i, e.clipboardData.getData("text"));
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-2.5" role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? LENGTH : 2}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${LENGTH}`}
          aria-invalid={invalid ? true : undefined}
          className={clsx(
            "h-14 w-full min-w-0 max-w-14 rounded-control border bg-surface-2/70 text-center font-display text-2xl font-semibold text-fg tabular-nums caret-lavender",
            "transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out-expo",
            "focus:border-lavender/60 focus:bg-surface-2 focus:outline-none focus:ring-4 focus:ring-primary/20",
            "disabled:opacity-60 aria-invalid:border-danger/60",
            d ? "border-border-strong" : "border-border",
          )}
        />
      ))}
    </div>
  );
}

/** Botón "Reenviar código" con cuenta regresiva + mensajes de resultado. */
export function ResendCode({ onResend, onSent }: { onResend: () => Promise<FormState>; onSent?: () => void }) {
  const [resendState, setResendState] = useState<FormState>(undefined);
  const [resending, startResend] = useTransition();
  const [cooldown, setCooldown] = useState(COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function resend() {
    startResend(async () => {
      const res = await onResend();
      setResendState(res);
      if (res?.ok) {
        setCooldown(COOLDOWN);
        onSent?.();
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-2 text-sm">
      {resendState?.ok ? <Alert variant="success" className="w-full">{resendState.ok}</Alert> : null}
      {resendState?.error ? <Alert variant="warning" className="w-full">{resendState.error}</Alert> : null}
      <p className="text-muted">¿No te llegó? Revisa spam o</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={resend}
        loading={resending}
        disabled={cooldown > 0}
        aria-live="polite"
        className="tabular-nums"
      >
        <RotateCw aria-hidden />
        {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "Reenviar código"}
      </Button>
    </div>
  );
}

export function OtpForm({ next }: { next?: string }) {
  const [digits, setDigits] = useState<string[]>(emptyOtp);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, formData) => {
    const res = await verifyEmail(prev, formData);
    if (res?.error) {
      // Wrong/expired code: clear and let them type again.
      setDigits(emptyOtp());
      requestAnimationFrame(() => refs.current[0]?.focus());
    }
    return res;
  }, undefined);
  const code = digits.join("");
  const error = state?.error;

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={action} className="flex flex-col gap-6">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <input type="hidden" name="code" value={code} />
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Código de verificación de 6 dígitos</legend>
          <OtpInput
            digits={digits}
            onDigitsChange={setDigits}
            // Auto-submit once complete.
            onComplete={() => requestAnimationFrame(() => formRef.current?.requestSubmit())}
            disabled={pending}
            invalid={!!error}
            inputRefs={refs}
          />
          {error ? (
            <p role="alert" className="text-center text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </fieldset>
        <SubmitButton fullWidth size="lg" disabled={code.length !== LENGTH} pendingText="Verificando…">
          Verificar
        </SubmitButton>
      </form>

      <ResendCode
        onResend={resendCode}
        onSent={() => {
          setDigits(emptyOtp());
          refs.current[0]?.focus();
        }}
      />
    </div>
  );
}

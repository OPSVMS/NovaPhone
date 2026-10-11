"use client";

import { createContext, useActionState, useContext, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { SubmitButton } from "@/components/ui/submit-button";

export type AdminAction = (prev: FormState, fd: FormData) => Promise<FormState>;

export function ActionResult({ state, className }: { state: FormState; className?: string }) {
  if (state?.ok) return <Alert variant="success" className={className}>{state.ok}</Alert>;
  if (state?.error) return <Alert variant="error" className={className}>{state.error}</Alert>;
  return null;
}

/* ------------------------------ Shared result ----------------------------- */

const GroupCtx = createContext<((r: FormState) => void) | null>(null);

/** Groups several action buttons so they share one result Alert. */
export function ActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  const [state, setState] = useState<FormState>(undefined);
  return (
    <GroupCtx.Provider value={setState}>
      <div className={clsx("flex flex-col gap-3", className)}>
        <div className="flex flex-wrap gap-2">{children}</div>
        <ActionResult state={state} />
      </div>
    </GroupCtx.Provider>
  );
}

function useAdminAction(action: AdminAction, after?: (r: FormState) => void) {
  const report = useContext(GroupCtx);
  const router = useRouter();
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, fd) => {
    let r: FormState;
    try {
      r = await action(prev, fd);
    } catch (e) {
      // Let Next.js redirects (e.g. expired session) through.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
      r = { error: "No se pudo completar la acción. Intenta de nuevo." };
    }
    after?.(r);
    report?.(r);
    router.refresh();
    return r;
  }, undefined);
  return { state: report ? undefined : state, formAction, grouped: !!report };
}

function Hidden({ fields }: { fields?: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/* ------------------------------ ActionButton ------------------------------ */

/** One-click (non-destructive) action. */
export function ActionButton({
  action,
  fields,
  children,
  pendingText,
  variant = "secondary",
  size = "sm",
  className,
}: {
  action: AdminAction;
  fields?: Record<string, string>;
  children: ReactNode;
  pendingText?: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
}) {
  const { state, formAction, grouped } = useAdminAction(action);
  const form = (
    <form action={formAction} className={grouped ? "contents" : undefined}>
      <Hidden fields={fields} />
      <SubmitButton variant={variant} size={size} pendingText={pendingText} className={className}>
        {children}
      </SubmitButton>
    </form>
  );
  if (grouped) return form;
  return (
    <div className="flex flex-col items-start gap-3">
      {form}
      <ActionResult state={state} className="w-full" />
    </div>
  );
}

/* ------------------------------ ConfirmAction ----------------------------- */

/** Button → confirmation dialog → server action. Extra inputs go in `children`. */
export function ConfirmAction({
  action,
  fields,
  label,
  variant = "secondary",
  size = "sm",
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  pendingText,
  children,
  className,
}: {
  action: AdminAction;
  fields?: Record<string, string>;
  label: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  confirmVariant?: "primary" | "danger";
  pendingText?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction, grouped } = useAdminAction(action, () => setOpen(false));
  const body = (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      <form action={formAction} className="contents">
        <Hidden fields={fields} />
        <Dialog
          open={open}
          onOpenChange={setOpen}
          size="sm"
          title={title}
          description={description}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Volver
              </Button>
              <SubmitButton variant={confirmVariant} pendingText={pendingText}>
                {confirmLabel}
              </SubmitButton>
            </>
          }
        >
          {children ? <div className="flex flex-col gap-4">{children}</div> : null}
        </Dialog>
      </form>
    </>
  );
  if (grouped) return body;
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">{body}</div>
      <ActionResult state={state} className="w-full" />
    </div>
  );
}

/** Small "reason" textarea used inside confirm dialogs. */
export function ReasonField({ name = "reason", label = "Motivo", optional = true, placeholder }: { name?: string; label?: string; optional?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      <Textarea id={id} name={name} rows={2} required={!optional} placeholder={placeholder} className="min-h-0" />
    </div>
  );
}

/* ----------------------------- Adjust balance ----------------------------- */

const mxn = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export function AdjustBalanceForm({ userId, balanceCents, action }: { userId: string; balanceCents: number; action: AdminAction }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const { state, formAction } = useAdminAction(action, (r) => {
    setOpen(false);
    if (r?.ok) {
      setAmount("");
      setReason("");
    }
  });
  const id = useId();
  const value = Math.abs(Number(amount.replace(",", ".")) || 0);
  const after = balanceCents / 100 + (direction === "credit" ? value : -value);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <Segmented
        aria-label="Tipo de ajuste"
        name="direction"
        value={direction}
        onValueChange={setDirection}
        fullWidth
        size="sm"
        options={[
          { value: "credit", label: "Abonar" },
          { value: "debit", label: "Cargar" },
        ]}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-amount`}>Monto</Label>
        <input type="hidden" name="amount" value={value ? String(value) : ""} />
        <Input
          id={`${id}-amount`}
          inputMode="decimal"
          autoComplete="off"
          required
          leading="$"
          trailing="MXN"
          placeholder="0.00"
          pattern="[0-9]+([.,][0-9]{1,2})?"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="tabular-nums"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-reason`}>Motivo</Label>
        <Input
          id={`${id}-reason`}
          name="reason"
          required
          minLength={3}
          autoComplete="off"
          placeholder="Ej. compensación por falla"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button
        variant="secondary"
        className="w-full sm:w-auto sm:self-start"
        onClick={() => {
          if (formRef.current?.reportValidity()) setOpen(true);
        }}
      >
        Aplicar ajuste
      </Button>
      <ActionResult state={state} />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={direction === "credit" ? "¿Abonar saldo?" : "¿Cargar saldo?"}
        description="Queda registrado en los movimientos del usuario y en la bitácora."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <SubmitButton variant={direction === "debit" ? "danger" : "primary"} pendingText="Aplicando…">
              {direction === "credit" ? `Sí, abonar ${mxn(value)}` : `Sí, cargar ${mxn(value)}`}
            </SubmitButton>
          </>
        }
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface-2/60 p-4 text-sm">
          <dt className="text-muted">Saldo actual</dt>
          <dd className="text-right font-display text-fg tabular-nums">{mxn(balanceCents / 100)}</dd>
          <dt className="text-muted">{direction === "credit" ? "Abono" : "Cargo"}</dt>
          <dd className={clsx("text-right font-display tabular-nums", direction === "credit" ? "text-success" : "text-danger")}>
            {direction === "credit" ? "+" : "−"}
            {mxn(value)}
          </dd>
          <dt className="text-muted">Saldo final</dt>
          <dd className={clsx("text-right font-display font-semibold tabular-nums", after < 0 ? "text-danger" : "text-fg")}>{mxn(after)}</dd>
          <dt className="text-muted">Motivo</dt>
          <dd className="text-right text-fg">{reason}</dd>
        </dl>
      </Dialog>
    </form>
  );
}

/* ------------------------------- Admin note ------------------------------- */

export function NoteForm({ userId, note, action }: { userId: string; note: string | null; action: AdminAction }) {
  const { state, formAction } = useAdminAction(action);
  const id = useId();
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <Label htmlFor={id} className="sr-only">
        Nota interna
      </Label>
      <Textarea id={id} name="note" rows={4} maxLength={2000} defaultValue={note ?? ""} placeholder="Solo visible para administradores." />
      <SubmitButton variant="secondary" size="sm" className="w-full sm:w-auto sm:self-start" pendingText="Guardando…">
        Guardar nota
      </SubmitButton>
      <ActionResult state={state} />
    </form>
  );
}

/* ------------------------------- Plan toggle ------------------------------ */

export function PlanToggle({ planId, active, name, action }: { planId: string; active: boolean; name: string; action: AdminAction }) {
  const { state, formAction } = useAdminAction(action);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <ToggleSubmit active={active} label={`${active ? "Ocultar" : "Activar"} ${name}`} />
      {state?.error ? <span role="alert" className="text-[12px] text-danger">{state.error}</span> : null}
    </form>
  );
}

function ToggleSubmit({ active, label }: { active: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      role="switch"
      aria-checked={active}
      aria-label={label}
      title={label}
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50",
        active ? "border-success/40 bg-success/25" : "border-border-strong bg-white/[0.04]",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "inline-block size-4 rounded-full shadow transition-transform duration-200 ease-out-expo",
          active ? "translate-x-[22px] bg-success" : "translate-x-[3px] bg-muted",
        )}
      />
    </button>
  );
}

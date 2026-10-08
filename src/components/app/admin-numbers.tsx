"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Cloud, Send, Unlink, Upload, UserPlus } from "lucide-react";
import { adminAddNumbers, adminAssignNumber, adminBuyNumbers, adminReleaseNumber, adminSyncCloudnumbering, adminTestSms } from "@/app/actions/numbers";
import type { FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

function Result({ state }: { state: FormState }) {
  if (state?.ok) return <Alert variant="success">{state.ok}</Alert>;
  if (state?.error) return <Alert variant="error">{state.error}</Alert>;
  return null;
}

/** Resetea el formulario tras un resultado exitoso. */
function useResettingAction(fn: (prev: FormState, fd: FormData) => Promise<FormState>) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const r = await fn(prev, fd);
    if (r?.ok) ref.current?.reset();
    return r;
  }, undefined);
  return [state, action, ref] as const;
}

export function AddNumbersForm() {
  const [state, action, ref] = useResettingAction(adminAddNumbers);
  const id = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload aria-hidden className="size-4 text-lavender" /> Agregar números
        </CardTitle>
        <CardDescription>Uno por línea, en formato internacional (+44…).</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={ref} action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-numbers`}>Números</Label>
            <Textarea
              id={`${id}-numbers`}
              name="numbers"
              required
              rows={4}
              placeholder={"+447700900123\n+447700900124"}
              className="font-mono text-sm"
              spellCheck={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-country`}>País</Label>
              <Select id={`${id}-country`} name="country" defaultValue="GB">
                <option value="GB">Reino Unido (GB)</option>
                <option value="US">Estados Unidos (US)</option>
                <option value="MX">México (MX)</option>
              </Select>
            </div>
            <Field label="Proveedor" name="provider" defaultValue="cloudnumbering" autoComplete="off" />
          </div>
          <Result state={state} />
          <SubmitButton variant="secondary" className="w-full sm:w-auto sm:self-start" pendingText="Agregando…">
            Agregar al inventario
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function AssignNumberForm({ numbers }: { numbers: string[] }) {
  const [state, action, ref] = useResettingAction(adminAssignNumber);
  const listId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus aria-hidden className="size-4 text-lavender" /> Asignar a un usuario
        </CardTitle>
        <CardDescription>Sin cobro (pruebas o cortesías). Se le envía un correo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={ref} action={action} className="flex flex-col gap-4">
          <Field label="Correo del usuario" name="email" type="email" required autoComplete="off" inputMode="email" />
          <Field
            label="Número"
            name="e164"
            optional
            list={listId}
            autoComplete="off"
            inputMode="tel"
            placeholder="Cualquiera disponible"
            className="font-mono"
          />
          <datalist id={listId}>
            {numbers.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Field
            label="ID de eSIM (orden)"
            name="orderId"
            optional
            autoComplete="off"
            spellCheck={false}
            placeholder="uuid de la orden"
            className="font-mono text-sm"
          />
          <Result state={state} />
          <SubmitButton variant="secondary" className="w-full sm:w-auto sm:self-start" pendingText="Asignando…">
            Asignar número
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function TestSmsForm({ numbers }: { numbers: string[] }) {
  const [state, action] = useActionState<FormState, FormData>(adminTestSms, undefined);
  const id = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send aria-hidden className="size-4 text-lavender" /> Simular SMS entrante
        </CardTitle>
        <CardDescription>Prueba la bandeja y el correo sin el proveedor.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-to`}>Para</Label>
              {numbers.length ? (
                <Select id={`${id}-to`} name="to" required defaultValue={numbers[0]} className="font-mono text-sm">
                  {numbers.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input id={`${id}-to`} name="to" required inputMode="tel" placeholder="+44…" className="font-mono" />
              )}
            </div>
            <Field label="De" name="from" defaultValue="WhatsApp" autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-body`}>Mensaje</Label>
            <Textarea
              id={`${id}-body`}
              name="body"
              required
              rows={3}
              defaultValue="Tu código de WhatsApp: 123-456. No lo compartas con nadie."
            />
          </div>
          <Result state={state} />
          <SubmitButton variant="secondary" className="w-full sm:w-auto sm:self-start" pendingText="Enviando…">
            Enviar SMS de prueba
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function ReleaseNumberButton({ numberId, e164, email }: { numberId: string; e164: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="w-full md:w-auto">
        <Unlink aria-hidden /> Liberar
      </Button>
      <form
        className="contents"
        action={async (fd) => {
          await adminReleaseNumber(fd);
          setOpen(false);
        }}
      >
        <input type="hidden" name="numberId" value={numberId} />
        <Dialog
          open={open}
          onOpenChange={setOpen}
          size="sm"
          title={`¿Liberar ${e164}?`}
          description="Se le quita al usuario y entra en espera 90 días antes de poder reasignarse. No hay reembolso automático."
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Volver
              </Button>
              <SubmitButton variant="danger" pendingText="Liberando…">
                Sí, liberar
              </SubmitButton>
            </>
          }
        >
          {email ? (
            <p className="rounded-2xl border border-border bg-surface-2/60 p-4 text-sm text-muted">
              Asignado a <span className="text-fg">{email}</span>
            </p>
          ) : null}
        </Dialog>
      </form>
    </>
  );
}

/** Panel de la cuenta de cloudnumbering: saldo, compra automática y sincronización. */
export function CloudnumberingPanel({ balance, enabled }: { balance: { balance: number; currency: string } | null; enabled: boolean }) {
  const [buyState, buyAction] = useActionState<FormState, FormData>(adminBuyNumbers, undefined);
  const [syncState, syncAction] = useActionState<FormState, FormData>(adminSyncCloudnumbering, undefined);
  const id = useId();
  const low = balance !== null && balance.balance < 20;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud aria-hidden className="size-4 text-lavender" /> Cuenta cloudnumbering
        </CardTitle>
        <CardDescription>
          {!enabled
            ? "Configura CLOUDNUMBERING_CLIENT_ID y CLOUDNUMBERING_CLIENT_SECRET."
            : balance
              ? (
                  <span className={low ? "text-warning" : undefined}>
                    Saldo: {balance.balance.toFixed(2)} {balance.currency}
                    {low ? " · recarga pronto: las renovaciones mensuales se cobran de este saldo" : ""}
                  </span>
                )
              : "No se pudo leer el saldo."}
        </CardDescription>
      </CardHeader>
      {enabled ? (
        <CardContent className="flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Si un cliente pide número y no hay inventario, se compra uno al momento (Reino Unido, plan mensual). Aquí puedes
            comprar por adelantado o importar los números que compraste en el portal.
          </p>
          <form action={buyAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-amount`}>Cantidad</Label>
              <Input id={`${id}-amount`} name="amount" type="number" min={1} max={20} defaultValue={1} className="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-country`}>País</Label>
              <Select id={`${id}-country`} name="country" defaultValue="GB">
                <option value="GB">Reino Unido (+44 7)</option>
                <option value="AU">Australia (+61 4)</option>
              </Select>
            </div>
            <SubmitButton pendingText="Comprando…">Comprar números</SubmitButton>
          </form>
          {buyState?.ok ? <Alert variant="success">{buyState.ok}</Alert> : null}
          {buyState?.error ? <Alert variant="error">{buyState.error}</Alert> : null}
          <form action={syncAction}>
            <SubmitButton variant="secondary" size="sm" pendingText="Sincronizando…">
              Sincronizar cuenta
            </SubmitButton>
          </form>
          {syncState?.ok ? <Alert variant="success">{syncState.ok}</Alert> : null}
          {syncState?.error ? <Alert variant="error">{syncState.error}</Alert> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

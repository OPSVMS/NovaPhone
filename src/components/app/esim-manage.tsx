"use client";

import { useActionState, useState } from "react";
import { Pause, Play, Settings2, XCircle } from "lucide-react";
import { cancelEsimAction, suspendAction } from "@/app/actions/esim";
import type { FormState } from "@/app/actions/auth";
import { formatMxn } from "@/lib/pricing";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { InstallStatusBadge } from "./status-badges";

type Props = {
  orderId: string;
  smdpStatus: string | null;
  suspended: boolean;
  canCancel: boolean;
  refundCents: number;
};

export function EsimManage({ orderId, smdpStatus, suspended, canCancel, refundCents }: Props) {
  const [dialog, setDialog] = useState<null | "cancel" | "suspend">(null);
  const close = () => setDialog(null);
  const [cancelState, cancelAction] = useActionState<FormState, FormData>(async (p, fd) => {
    const r = await cancelEsimAction(p, fd);
    if (r?.ok) close();
    return r;
  }, undefined);
  const [suspendState, suspendFormAction] = useActionState<FormState, FormData>(async (p, fd) => {
    const r = await suspendAction(p, fd);
    if (r?.ok) close();
    return r;
  }, undefined);
  const installed = !!smdpStatus && smdpStatus !== "RELEASED";
  const message = cancelState?.ok ?? suspendState?.ok;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 aria-hidden className="size-4 text-lavender" /> Administrar
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          Estado en tu teléfono: <InstallStatusBadge smdpStatus={smdpStatus} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {message ? <Alert variant="success">{message}</Alert> : null}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          {installed ? (
            suspended ? (
              <form action={suspendFormAction}>
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="suspend" value="0" />
                <SubmitButton variant="secondary" className="w-full sm:w-auto" pendingText="Reactivando…">
                  <Play aria-hidden /> Reactivar eSIM
                </SubmitButton>
              </form>
            ) : (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setDialog("suspend")}>
                <Pause aria-hidden /> Pausar eSIM
              </Button>
            )
          ) : null}
          {canCancel ? (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setDialog("cancel")}>
              <XCircle aria-hidden /> Cancelar y reembolsar
            </Button>
          ) : null}
        </div>
        <p className="text-[13px] leading-relaxed text-subtle">
          {canCancel
            ? `¿Compraste por error? Mientras no la instales puedes cancelarla y te devolvemos ${formatMxn(refundCents)} a tu saldo.`
            : "Pausa tu eSIM si pierdes tu teléfono o no la vas a usar; puedes reactivarla cuando quieras. La pausa no detiene la vigencia."}
        </p>
        {suspendState?.error ? <Alert variant="error">{suspendState.error}</Alert> : null}
      </CardContent>

      <form action={suspendFormAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="suspend" value="1" />
        <Dialog
          open={dialog === "suspend"}
          onOpenChange={(o) => !o && close()}
          size="sm"
          title="¿Pausar esta eSIM?"
          description="Dejará de conectarse a internet hasta que la reactives. Tus datos restantes se conservan, pero los días siguen corriendo."
          footer={
            <>
              <Button variant="ghost" onClick={close}>Volver</Button>
              <SubmitButton pendingText="Pausando…">Sí, pausar</SubmitButton>
            </>
          }
        >
          {suspendState?.error ? <Alert variant="error">{suspendState.error}</Alert> : null}
        </Dialog>
      </form>

      <form action={cancelAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <Dialog
          open={dialog === "cancel"}
          onOpenChange={(o) => !o && close()}
          size="sm"
          title="¿Cancelar esta eSIM?"
          description={`La eSIM se elimina y te devolvemos ${formatMxn(refundCents)} a tu saldo. Esta acción no se puede deshacer.`}
          footer={
            <>
              <Button variant="ghost" onClick={close}>Volver</Button>
              <SubmitButton variant="danger" pendingText="Cancelando…">Sí, cancelar y reembolsar</SubmitButton>
            </>
          }
        >
          {cancelState?.error ? <Alert variant="error">{cancelState.error}</Alert> : null}
        </Dialog>
      </form>
    </Card>
  );
}

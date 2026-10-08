"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { adminApproveDeposit, adminCancelDeposit } from "@/app/actions/wallet";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/submit-button";

/** Approve / cancel a pending deposit, each behind a confirmation dialog. */
export function AdminDepositActions({
  depositId,
  amount,
  email,
  reference,
  method,
}: {
  depositId: string;
  amount: string;
  email: string;
  reference: string;
  method: string;
}) {
  const [open, setOpen] = useState<"approve" | "cancel" | null>(null);
  const close = () => setOpen(null);

  const details = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface-2/60 p-4 text-sm">
      <dt className="text-muted">Usuario</dt>
      <dd className="truncate text-right text-fg">{email}</dd>
      <dt className="text-muted">Método</dt>
      <dd className="text-right text-fg">{method}</dd>
      <dt className="text-muted">Referencia</dt>
      <dd className="text-right font-mono text-fg">{reference}</dd>
      <dt className="text-muted">Monto</dt>
      <dd className="text-right font-display font-semibold text-fg tabular-nums">{amount}</dd>
    </dl>
  );

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setOpen("approve")} className="flex-1 md:flex-none">
        <Check aria-hidden /> Aprobar
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen("cancel")} className="flex-1 md:flex-none">
        <X aria-hidden /> Cancelar
      </Button>

      <form
        className="contents"
        action={async (fd) => {
          await adminApproveDeposit(fd);
          close();
        }}
      >
        <input type="hidden" name="depositId" value={depositId} />
        <Dialog
          open={open === "approve"}
          onOpenChange={(o) => !o && close()}
          size="sm"
          title="¿Aprobar depósito?"
          description="Se acreditará el saldo al usuario y se le enviará un correo. Verifica que el pago llegó a la cuenta."
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                Volver
              </Button>
              <SubmitButton pendingText="Acreditando…">Sí, acreditar {amount}</SubmitButton>
            </>
          }
        >
          {details}
        </Dialog>
      </form>

      <form
        className="contents"
        action={async (fd) => {
          await adminCancelDeposit(fd);
          close();
        }}
      >
        <input type="hidden" name="depositId" value={depositId} />
        <Dialog
          open={open === "cancel"}
          onOpenChange={(o) => !o && close()}
          size="sm"
          title="¿Cancelar depósito?"
          description="El usuario verá el depósito como cancelado y no se acreditará saldo."
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                Volver
              </Button>
              <SubmitButton variant="danger" pendingText="Cancelando…">
                Sí, cancelar
              </SubmitButton>
            </>
          }
        >
          {details}
        </Dialog>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Coins, CreditCard, Landmark, Repeat, Zap } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { CopyField, InfoRow } from "./copy-field";
import { DepositForm } from "./deposit-form";
import { CardDepositForm } from "./card-deposit-form";
import type { CardFeeConfig } from "./card-fee";

export type FundsMethod = "spei" | "card" | "usdt";

const groupClabe = (c: string) => c.replace(/\s/g, "").replace(/(\d{3})(\d{3})(\d{11})(\d)/, "$1 $2 $3 $4");

export function FundsMethods({
  initialMethod,
  clabe,
  beneficiary,
  cardEnabled,
  fee,
  defaultAmount,
  min,
  max,
  cardMax,
}: {
  initialMethod: FundsMethod;
  clabe: string | null;
  beneficiary: string;
  cardEnabled: boolean;
  fee: CardFeeConfig;
  defaultAmount?: number;
  min: number;
  max: number;
  cardMax: number;
}) {
  const [method, setMethod] = useState<FundsMethod>(initialMethod);

  return (
    <div className="flex flex-col gap-6">
      <Segmented<FundsMethod>
        aria-label="Método de pago"
        value={method}
        onValueChange={setMethod}
        fullWidth
        options={[
          { value: "spei", label: "SPEI", icon: <Landmark aria-hidden /> },
          { value: "card", label: "Tarjeta", icon: <CreditCard aria-hidden /> },
          { value: "usdt", label: "USDT", icon: <Coins aria-hidden /> },
        ]}
      />

      <div role="region" aria-label={method === "spei" ? "SPEI" : method === "card" ? "Tarjeta" : "USDT"}>
        {method === "spei" ? (
          clabe ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold text-fg">Tu CLABE personal</h2>
                <p className="text-[15px] leading-relaxed text-muted">
                  Transfiere cualquier monto desde tu banco; se acredita automáticamente en minutos. Puedes programar una
                  transferencia recurrente.
                </p>
              </div>
              <CopyField
                label="CLABE"
                value={clabe}
                display={groupClabe(clabe)}
                size="lg"
                copyLabel="Copiar CLABE"
                className="border-lavender/30 bg-primary/[0.07]"
              />
              <div className="divide-y divide-border px-1">
                <InfoRow label="Beneficiario">{beneficiary}</InfoRow>
                <InfoRow label="Monto">Cualquiera, sin referencia</InfoRow>
              </div>
              <ul className="grid gap-3 text-[13px] leading-relaxed text-muted sm:grid-cols-2">
                <li className="flex gap-2.5 rounded-2xl border border-border bg-surface-2/40 p-3.5">
                  <Zap aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" />
                  Es solo tuya: cada transferencia se suma a tu saldo y te avisamos por correo.
                </li>
                <li className="flex gap-2.5 rounded-2xl border border-border bg-surface-2/40 p-3.5">
                  <Repeat aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" />
                  Guárdala como contacto en tu banco y programa una transferencia mensual.
                </li>
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[13px] text-subtle">
                Transferencia desde tu banco o app. Te damos una referencia y se acredita en minutos.
              </p>
              <DepositForm method="spei" defaultAmount={defaultAmount} min={min} max={max} />
            </div>
          )
        ) : method === "card" ? (
          <CardDepositForm enabled={cardEnabled} fee={fee} defaultAmount={defaultAmount} min={min} max={cardMax} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-subtle">
              Envía USDT desde tu wallet o exchange. Se acredita tras confirmarse en la red.
            </p>
            <DepositForm method="usdt" defaultAmount={defaultAmount} min={min} max={max} />
          </div>
        )}
      </div>
    </div>
  );
}

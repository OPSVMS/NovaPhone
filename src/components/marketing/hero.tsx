import { BadgeCheck, Check, Lock, QrCode } from "lucide-react";
import { Container } from "@/components/ui/container";
import { formatMxn } from "./format";
import { PlanPicker } from "./plan-picker";
import { RECOMMENDED_PLAN_ID, VISIBLE_PLAN_IDS, type MarketingPlan } from "./plans-data";

const chips = [
  { icon: QrCode, label: "QR en 2 min" },
  { icon: BadgeCheck, label: "Garantía de conexión" },
  { icon: Lock, label: "Pago seguro Stripe" },
];

/** Desktop-only answers next to the picker (mobile gets them in "Cómo funciona" and the FAQ). */
const facts = [
  "Una eSIM es una SIM digital que se instala con un QR, sin chip físico.",
  "Tu chip actual sigue funcionando para llamadas.",
  "Funciona en iPhone XS o más nuevo, Galaxy S20 o más nuevo y Pixel 3 o más nuevo.",
  "Recargas en la misma eSIM cuando se acaben tus datos.",
];

/**
 * Hero = buy box. Promise (H1) + proof (subline, chips) + action (picker) in the first screen.
 * Mobile: copy on top, picker right under it. Desktop: copy left, picker card right.
 */
export function Hero({ plans }: { plans: MarketingPlan[] }) {
  const rec = plans.find((p) => p.id === RECOMMENDED_PLAN_ID);
  return (
    <section id="planes" aria-labelledby="hero-titulo" className="relative isolate scroll-mt-16 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_60%_at_15%_0%,rgb(31_111_209/0.13),transparent_70%),radial-gradient(40%_50%_at_95%_10%,rgb(255_163_26/0.12),transparent_70%)]"
      />
      <Container className="grid gap-7 pb-12 pt-4 sm:pt-12 lg:grid-cols-[1fr_440px] lg:items-start lg:gap-14 lg:pb-20 lg:pt-16 xl:grid-cols-[1fr_460px]">
        <div className="flex flex-col gap-3.5 sm:gap-5 lg:pt-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-surface px-3 py-1 text-[13px] font-semibold text-primary shadow-card">
            <span aria-hidden className="size-2 rounded-full bg-marigold" />
            eSIM de datos para México
          </p>
          <h1
            id="hero-titulo"
            className="text-[2.15rem] font-bold leading-[1.06] tracking-[-0.03em] text-fg sm:max-w-[16ch] sm:text-5xl lg:text-6xl"
          >
            Internet para tu celular en <span className="whitespace-nowrap text-primary">2&nbsp;minutos</span>.
          </h1>
          <p className="max-w-[44ch] text-[17px] leading-snug text-muted sm:text-lg sm:leading-relaxed">
            Sin contrato ni trámites.
            {rec ? (
              <>
                {" "}
                <strong className="font-semibold text-fg tabular-nums">
                  {rec.dataGb} GB por {formatMxn(rec.priceMxn)}
                </strong>
                .
              </>
            ) : null}
          </p>
          <p className="text-[15px] font-medium leading-snug text-fg">Red Telcel 5G · paga con tarjeta o SPEI · QR al instante</p>
          <ul className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" data-testid="trust-chips">
            {chips.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface px-1.5 py-2 text-center text-[12px] font-semibold leading-tight text-fg shadow-card sm:h-9 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-0 sm:text-[13px]"
              >
                <Icon aria-hidden className="size-4 shrink-0 text-success" />
                {label}
              </li>
            ))}
          </ul>
          <ul className="mt-3 hidden flex-col gap-2.5 border-t border-border pt-5 text-[15px] text-muted lg:flex">
            {facts.map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <Check aria-hidden className="mt-0.5 size-[18px] shrink-0 text-primary" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-panel border border-border bg-surface p-4 shadow-raised sm:p-6">
          <PlanPicker plans={plans} visibleIds={VISIBLE_PLAN_IDS} recommendedId={RECOMMENDED_PLAN_ID} />
        </div>
      </Container>
    </section>
  );
}

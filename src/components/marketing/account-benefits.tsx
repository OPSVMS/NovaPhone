import { Activity, ArrowUp, Layers, MessageSquareText, RefreshCw, Repeat } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { WhatsAppIcon } from "./whatsapp";

/**
 * Only claims the platform actually delivers (owner decision 2026-10-16). Do not add "100 eSIMs" or
 * "varios números": an account can hold several eSIMs but only one number.
 */
const benefits: { icon: ComponentType<{ className?: string }>; label: string }[] = [
  { icon: Activity, label: "Tu consumo en tiempo real" },
  { icon: Layers, label: "Varias eSIMs en una cuenta" },
  { icon: RefreshCw, label: "Recarga sin cambiar de QR" },
  { icon: Repeat, label: "Recargas automáticas opcionales" },
  { icon: MessageSquareText, label: "Número para códigos por SMS o llamada" },
  { icon: WhatsAppIcon, label: "Soporte por WhatsApp" },
];

/** "Lo que incluye tu cuenta": six compact items (2 columns on phones) and a second CTA back to the picker. */
export function AccountBenefits() {
  return (
    <section id="tu-cuenta" aria-labelledby="tu-cuenta-titulo" className="scroll-mt-16 py-10 sm:py-14">
      <Container className="flex flex-col gap-5 sm:gap-7">
        <h2 id="tu-cuenta-titulo" className="text-2xl font-bold text-fg sm:text-3xl">
          Lo que incluye tu cuenta
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3" data-testid="account-benefits">
          {benefits.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 text-[13.5px] font-semibold leading-snug text-fg shadow-card sm:gap-3 sm:p-4 sm:text-[15px]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/[0.07] text-link sm:size-10 sm:rounded-xl">
                <Icon aria-hidden className="size-4 sm:size-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
        <Button href="#elegir-plan" size="lg" className="w-full sm:w-auto sm:self-start" data-testid="benefits-cta">
          Elegir mi plan
          <ArrowUp aria-hidden />
        </Button>
      </Container>
    </section>
  );
}

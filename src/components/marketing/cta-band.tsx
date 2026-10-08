import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { FadeIn } from "@/components/motion/fade-in";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { AUTH_LINKS } from "./nav";

export function CtaBand({
  title = "Tu próxima conexión está a dos minutos.",
  description = "Crea tu cuenta con tu correo, agrega saldo y navega en la red Telcel 5G hoy mismo.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Section spacing="md">
      <FadeIn>
        <div className="noise relative isolate overflow-hidden rounded-panel border border-border bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
          {/* static glow + grid, no extra aurora on the page */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[140%] w-[120%] -translate-x-1/2 -translate-y-1/3 bg-[radial-gradient(closest-side,rgb(118_82_240/0.32),transparent)]"
          />
          <div aria-hidden className="bg-grid mask-fade-radial pointer-events-none absolute inset-0 -z-10 opacity-60" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-lavender-soft/60 to-transparent"
          />

          <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
            <LogoMark size={40} title={null} />
            <h2 className="text-gradient text-3xl font-semibold leading-[1.1] sm:text-5xl">{title}</h2>
            <p className="text-base leading-relaxed text-muted sm:text-lg">{description}</p>
            <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button href={AUTH_LINKS.signup} size="lg" variant="inverse" className="w-full sm:w-auto">
                Crear cuenta
                <ArrowRight className="transition-transform duration-200 ease-out-expo group-hover/button:translate-x-0.5" />
              </Button>
              <Button href="/planes" size="lg" variant="outline" className="w-full sm:w-auto">
                Ver planes
              </Button>
            </div>
            <p className="text-[13px] text-subtle">Sin CURP · Sin contratos · Paga con SPEI o USDT</p>
          </div>
        </div>
      </FadeIn>
    </Section>
  );
}

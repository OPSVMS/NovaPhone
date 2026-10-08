import { ArrowRight, RadioTower, Timer, Wallet } from "lucide-react";
import { Aurora } from "@/components/motion/aurora";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeroVisual } from "./hero-visual";

const trust = [
  { icon: RadioTower, label: "Red Telcel 5G" },
  { icon: Timer, label: "Activa en 2 min" },
  { icon: Wallet, label: "SPEI / USDT" },
];

export function Hero() {
  return (
    <section className="relative isolate -mt-[calc(4rem+env(safe-area-inset-top))] overflow-hidden pt-[calc(4rem+env(safe-area-inset-top))]">
      <Aurora variant="hero" />
      <Container className="grid items-center gap-12 pb-16 pt-12 sm:pb-24 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="flex flex-col items-start gap-6 sm:gap-7">
          <FadeIn immediate y={10}>
            <Badge variant="primary" dot>
              eSIM de datos para México
            </Badge>
          </FadeIn>

          <FadeIn immediate delay={0.06} as="div">
            <h1 className="max-w-[14ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              <span className="text-gradient">Internet 5G en México.</span>{" "}
              <span className="text-gradient-brand">Sin papeleo.</span>
            </h1>
          </FadeIn>

          <FadeIn immediate delay={0.12}>
            <p className="max-w-[46ch] text-base leading-relaxed text-muted sm:text-lg">
              Una eSIM de datos sobre la red Telcel 5G. Crea tu cuenta con tu correo, paga con SPEI o USDT y
              conéctate en minutos. Sin contratos ni plazos forzosos.
            </p>
          </FadeIn>

          <FadeIn immediate delay={0.18} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button href="/#planes" size="lg" className="w-full sm:w-auto">
              Ver planes
              <ArrowRight className="transition-transform duration-200 ease-out-expo group-hover/button:translate-x-0.5" />
            </Button>
            <Button href="/#como-funciona" size="lg" variant="secondary" className="w-full sm:w-auto">
              Cómo funciona
            </Button>
          </FadeIn>

          <FadeIn immediate delay={0.26}>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[13px] text-muted">
              {trust.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-2">
                  <Icon aria-hidden className="size-4 text-lavender" />
                  {label}
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>

        <div className="relative">
          <HeroVisual />
        </div>
      </Container>
    </section>
  );
}

import { ArrowRight, ShieldCheck } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import { PlanCard } from "./plan-card";
import type { MarketingPlan } from "./plans-data";

/** Landing plans block: a curated set, horizontal snap scroll on phones. */
export function PlansSection({ plans, total }: { plans: MarketingPlan[]; total: number }) {
  return (
    <Section id="planes" className="scroll-mt-16">
      <FadeIn>
        <SectionHeader
          eyebrow="Planes"
          title="Elige tus datos. Paga solo eso."
          description="Paquetes de datos 5G de prepago. Los días empiezan a contar cuando te conectas por primera vez."
        />
      </FadeIn>

      <Stagger
        as="ul"
        className="-mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-2 [scrollbar-width:none] sm:mx-0 sm:mt-16 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
      >
        {plans.map((plan) => (
          <StaggerItem
            as="li"
            key={plan.id}
            className={`w-[82%] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none ${plan.featured ? "order-first sm:order-none" : ""}`}
          >
            <PlanCard plan={plan} />
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden className="size-4 text-lavender" />
          Precio en pesos, sin cargos ocultos
        </p>
        <Button href="/planes" variant="ghost">
          Ver los {total} planes
          <ArrowRight />
        </Button>
      </FadeIn>
    </Section>
  );
}

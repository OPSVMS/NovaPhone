import type { Metadata } from "next";
import { Check, ShieldCheck } from "lucide-react";
import { Aurora } from "@/components/motion/aurora";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section, SectionHeader } from "@/components/ui/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { PLANES_FAQ } from "@/components/marketing/faq-data";
import { FaqSection } from "@/components/marketing/faq-section";
import { PlanCard } from "@/components/marketing/plan-card";
import { getMarketingPlans, type MarketingPlan } from "@/components/marketing/plans-data";
import { PlansTable } from "@/components/marketing/plans-table";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Planes de datos 5G",
  description:
    "Compara los planes de eSIM de datos NovaPhone para México: de 1 GB a 50 GB, en la red Telcel 5G. Precio en pesos con IVA incluido, sin cargos ocultos.",
  alternates: { canonical: "/planes" },
};

const included = [
  "Red Telcel 5G con respaldo AT&T 5G",
  "Entrega instantánea por correo y en tu panel",
  "Instalación con QR o con un toque en iPhone (iOS 17.4+)",
  "La vigencia empieza en tu primera conexión",
  "Recargas en la misma eSIM, sin reinstalar",
  "Auto-recarga opcional con tu saldo",
  "Consumo y días restantes en tu panel",
  "Sin contratos ni plazos forzosos",
  "Soporte humano para instalar y resolver dudas",
];

function PlanGroup({ id, title, description, plans }: { id: string; title: string; description: string; plans: MarketingPlan[] }) {
  if (!plans.length) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6">
      <FadeIn className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <h2 id={id} className="text-2xl font-semibold text-fg">
          {title}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </FadeIn>
      <Stagger as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {plans.map((plan) => (
          <StaggerItem as="li" key={plan.id}>
            <PlanCard plan={plan} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

export default async function PlanesPage() {
  const plans = await getMarketingPlans();
  const monthly = plans.filter((p) => p.days >= 30);
  const short = plans.filter((p) => p.days < 30);

  return (
    <>
      <section className="relative isolate -mt-[calc(4rem+env(safe-area-inset-top))] overflow-hidden pt-[calc(4rem+env(safe-area-inset-top))]">
        <Aurora variant="subtle" grid />
        <Container className="flex flex-col items-center gap-5 pb-4 pt-14 text-center sm:pt-20">
          <FadeIn immediate y={10}>
            <Badge variant="primary" dot>
              Red Telcel 5G
            </Badge>
          </FadeIn>
          <FadeIn immediate delay={0.06}>
            <h1 className="text-gradient max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
              Planes de datos 5G para México
            </h1>
          </FadeIn>
          <FadeIn immediate delay={0.12}>
            <p className="max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg">
              Elige cuántos datos necesitas y por cuántos días. Precios en pesos con IVA incluido.
            </p>
          </FadeIn>
          <FadeIn immediate delay={0.18}>
            <p className="inline-flex items-center gap-2 text-[13px] text-subtle">
              <ShieldCheck aria-hidden className="size-4 text-lavender" />
              Precio en pesos, sin cargos ocultos
            </p>
          </FadeIn>
        </Container>
      </section>

      <Section spacing="sm" className="pt-8 sm:pt-12">
        <div className="flex flex-col gap-14 sm:gap-20">
          <PlanGroup id="planes-mes" title="Para todo el mes" description="30 días de vigencia" plans={monthly} />
          <PlanGroup id="planes-cortos" title="Para unos días" description="Vigencias cortas, ideales como respaldo" plans={short} />
        </div>
      </Section>

      <Section spacing="md">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-12">
          <div className="flex flex-col gap-6">
            <FadeIn>
              <SectionHeader align="left" eyebrow="Comparativa" title="Todos los planes, lado a lado" />
            </FadeIn>
            <FadeIn delay={0.06}>
              <PlansTable plans={plans} />
            </FadeIn>
            <p className="text-[13px] text-subtle">
              Precios en MXN con IVA incluido. El precio por GB es aproximado y se muestra solo como referencia.
            </p>
          </div>
          <FadeIn delay={0.1} className="lg:pt-24">
            <div className="rounded-card border border-border bg-surface p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-fg">Todos los planes incluyen</h2>
              <ul className="mt-5 flex flex-col gap-3 text-[15px] text-muted">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-lavender" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-border pt-5 text-sm leading-relaxed text-muted">
                Es una eSIM <span className="text-fg">solo de datos</span>: no incluye número ni SMS. Recuerda activar
                “Roaming de datos” en la línea NovaPhone.
              </p>
            </div>
          </FadeIn>
        </div>
      </Section>

      <FaqSection items={PLANES_FAQ} />
      <CtaBand title="Elige tu plan y conéctate hoy." />
    </>
  );
}

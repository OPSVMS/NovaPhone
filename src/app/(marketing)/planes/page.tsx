import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { FaqSection } from "@/components/marketing/faq-section";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PlanPicker } from "@/components/marketing/plan-picker";
import { RECOMMENDED_PLAN_ID, getMarketingPlans } from "@/components/marketing/plans-data";
import { NUMBER_PRICE_MXN } from "@/lib/numbers";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Planes y precios de eSIM México",
  description:
    "Precios de la eSIM de datos NovaPhone para México en red Telcel 5G: desde 1 GB por $39 MXN hasta 20 GB por $599 MXN. IVA incluido, sin contrato.",
  alternates: { canonical: "/planes" },
};

/** Same buy box as the landing, with every plan visible. */
export default async function PlanesPage() {
  const plans = await getMarketingPlans();
  return (
    <>
      <section aria-labelledby="planes-h1" className="pb-12 pt-6 sm:pt-12">
        <Container size="sm" className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 id="planes-h1" className="text-3xl font-bold text-fg sm:text-4xl">
              Planes de datos para México
            </h1>
            <p className="text-[17px] leading-relaxed text-muted">Red Telcel 5G. Sin contrato. Precios en pesos con IVA.</p>
          </div>
          <div className="rounded-panel border border-border bg-surface p-4 shadow-raised sm:p-6">
            <PlanPicker plans={plans} recommendedId={RECOMMENDED_PLAN_ID} numberPriceMxn={NUMBER_PRICE_MXN()} />
          </div>
        </Container>
      </section>
      <HowItWorks />
      <FaqSection />
    </>
  );
}

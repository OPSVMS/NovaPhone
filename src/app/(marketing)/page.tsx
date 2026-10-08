import type { Metadata } from "next";
import { AlwaysConnected } from "@/components/marketing/always-connected";
import { Compatibility } from "@/components/marketing/compatibility";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { getMarketingPlans, pickHighlights } from "@/components/marketing/plans-data";
import { PlansSection } from "@/components/marketing/plans-section";
import { ValueProps } from "@/components/marketing/value-props";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "NovaPhone — Internet 5G en México. Sin papeleo." },
  description:
    "eSIM de datos para México sobre la red Telcel 5G. Sin CURP ni documentos, sin contratos. Activa en 2 minutos y paga con SPEI o USDT.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const plans = await getMarketingPlans();
  return (
    <>
      <Hero />
      <div className="hairline mx-auto max-w-6xl" />
      <ValueProps />
      <PlansSection plans={pickHighlights(plans)} total={plans.length} />
      <AlwaysConnected />
      <HowItWorks />
      <Compatibility />
      <FaqSection />
      <CtaBand />
    </>
  );
}

import type { Metadata } from "next";
import { AccountBenefits } from "@/components/marketing/account-benefits";
import { FaqSection } from "@/components/marketing/faq-section";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { LandingJsonLd } from "@/components/marketing/json-ld";
import { formatMxn } from "@/components/marketing/format";
import { RECOMMENDED_PLAN_ID, getMarketingPlans } from "@/components/marketing/plans-data";
import { NUMBER_PRICE_MXN } from "@/lib/numbers";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const plans = await getMarketingPlans();
  const rec = plans.find((p) => p.id === RECOMMENDED_PLAN_ID);
  const min = Math.min(...plans.map((p) => p.priceMxn));
  const offer = rec ? ` ${rec.dataGb} GB por ${formatMxn(rec.priceMxn)}.` : "";
  return {
    title: { absolute: `eSIM México de datos en red Telcel 5G · desde ${formatMxn(min)} | NovaPhone` },
    description: `eSIM de datos para México en red Telcel 5G. Actívala en 2 minutos con un QR, sin contrato ni trámites.${offer} Paga con tarjeta o SPEI.`,
    alternates: { canonical: "/" },
    openGraph: {
      title: "eSIM de datos para México · NovaPhone",
      description: `Internet para tu celular en 2 minutos. Red Telcel 5G, sin contrato.${offer}`,
      url: "/",
    },
  };
}

export default async function HomePage() {
  const plans = await getMarketingPlans();
  return (
    <>
      <Hero plans={plans} numberPriceMxn={NUMBER_PRICE_MXN()} />
      <HowItWorks />
      <AccountBenefits />
      <FaqSection />
      <LandingJsonLd plans={plans} baseUrl={process.env.APP_URL || undefined} />
    </>
  );
}

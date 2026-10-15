import type { MarketingPlan } from "./plans-data";

const SITE = "https://novaphone.lat";

function toJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Organization + Product (one Offer per marketed plan) for the landing. */
export function LandingJsonLd({ plans, baseUrl = SITE }: { plans: MarketingPlan[]; baseUrl?: string }) {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: "NovaPhone",
    url: baseUrl,
    logo: `${baseUrl}/icon.svg`,
    legalName: "MASMOVIL S.A. de C.V.",
    address: { "@type": "PostalAddress", addressLocality: "Guadalajara", addressRegion: "Jalisco", addressCountry: "MX" },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://wa.me/message/CMMXYJLZ353VC1",
      availableLanguage: ["es"],
      areaServed: "MX",
    },
  };
  const prices = plans.map((p) => p.priceMxn);
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "eSIM de datos para México – NovaPhone",
    description:
      "eSIM de solo datos para México en red Telcel 5G. Se instala con un QR en 2 minutos, sin contrato. Recargas en la misma eSIM.",
    brand: { "@type": "Brand", name: "NovaPhone" },
    image: `${baseUrl}/opengraph-image`,
    category: "eSIM de datos móviles",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "MXN",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: plans.length,
      offers: plans.map((p) => ({
        "@type": "Offer",
        sku: p.id,
        name: `${p.dataGb} GB · ${p.days} días`,
        price: p.priceMxn,
        priceCurrency: "MXN",
        availability: "https://schema.org/InStock",
        url: `${baseUrl}/?plan=${p.id}#planes`,
        seller: { "@id": `${baseUrl}/#organization` },
      })),
    },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJson(org) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJson(product) }} />
    </>
  );
}

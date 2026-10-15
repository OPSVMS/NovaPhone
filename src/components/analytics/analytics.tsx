import Script from "next/script";
import { GA4_ID, GOOGLE_ADS_ID, GTAG_LOADER_ID } from "@/lib/analytics/config";
import { AnalyticsClient } from "./analytics-client";

/**
 * gtag bootstrap (México: sin banner de consentimiento; todo concedido). En /compra/* la URL lleva el token de acceso
 * a la eSIM (?t=…): se manda a Google sin query.
 */
function bootstrapScript(): string {
  const lines = [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    "gtag('js',new Date());",
    "var npLoc=location.pathname.indexOf('/compra/')===0?location.origin+location.pathname:location.href;",
    "gtag('set',{page_location:npLoc});",
  ];
  if (GA4_ID) lines.push(`gtag('config',${JSON.stringify(GA4_ID)},{page_location:npLoc});`);
  if (GOOGLE_ADS_ID) lines.push(`gtag('config',${JSON.stringify(GOOGLE_ADS_ID)},{allow_enhanced_conversions:true,page_location:npLoc});`);
  return lines.join("\n");
}

/**
 * Se monta una vez en el layout raíz. Carga gtag.js (GA4 y/o Google Ads), Microsoft Clarity, captura la atribución
 * (gclid/utm → cookie `np_attr`) y registra `page_view` en el embudo propio. Cada pieza es no-op sin su variable.
 */
export function Analytics() {
  return (
    <>
      {GTAG_LOADER_ID ? (
        <>
          <Script id="np-gtag-init" strategy="afterInteractive">
            {bootstrapScript()}
          </Script>
          <Script id="np-gtag-js" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GTAG_LOADER_ID)}`} />
        </>
      ) : null}
      <AnalyticsClient />
    </>
  );
}

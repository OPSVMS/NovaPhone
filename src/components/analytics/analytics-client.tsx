"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { CLARITY_ID } from "@/lib/analytics/config";
import { captureAttribution } from "@/lib/analytics/capture";
import { gtag } from "@/lib/analytics/browser";
import { logEvent } from "@/lib/analytics/funnel-client";

/** La página de éxito lleva el token de acceso a la eSIM en la URL: nunca se manda a terceros. */
const isPrivate = (p: string) => p.startsWith("/compra/");

function clarityScript(projectId: string): string {
  return [
    "(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};",
    "t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;",
    "y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);",
    `})(window,document,'clarity','script',${JSON.stringify(projectId)});`,
  ].join("");
}

/**
 * Atribución una vez por carga, `page_view` del embudo propio una vez por ruta y Microsoft Clarity (grabaciones y
 * mapas de calor; no se carga en /compra/* para no grabar el QR ni el token).
 */
export function AnalyticsClient() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    // Después de la captura de atribución: `np_attr` ya está escrita.
    logEvent("page_view");
    // gtag config ya envía la primera vista; las navegaciones del cliente se mandan aquí.
    if (first.current) first.current = false;
    else gtag("event", "page_view", { page_path: pathname, page_location: isPrivate(pathname) ? window.location.origin + pathname : window.location.href });
  }, [pathname]);

  return CLARITY_ID && pathname && !isPrivate(pathname) ? (
    <Script id="np-clarity" strategy="afterInteractive">
      {clarityScript(CLARITY_ID)}
    </Script>
  ) : null;
}

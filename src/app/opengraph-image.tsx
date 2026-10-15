import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getMarketingPlans, RECOMMENDED_PLAN_ID } from "@/components/marketing/plans-data";

export const alt = "NovaPhone — eSIM de datos para México en red Telcel 5G.";
export const revalidate = 3600;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand mark (same geometry as src/components/brand/logo.tsx), Azul Nova strokes + marigold node.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0A2F6B"/><stop offset=".55" stop-color="#0A4FA3"/><stop offset="1" stop-color="#3B8CE6"/></linearGradient></defs><g fill="none" stroke="url(#g)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 51V13L24.22 24.22"/><path d="M51 13V51L39.78 39.78"/></g><circle cx="32" cy="32" r="4.5" fill="#FFA31A"/></svg>`;

export default async function Image() {
  const fontDir = join(process.cwd(), "src/assets/fonts");
  const [semibold, regular] = await Promise.all([
    readFile(join(fontDir, "Sora-SemiBold.ttf")),
    readFile(join(fontDir, "Sora-Regular.ttf")),
  ]);
  const plans = await getMarketingPlans();
  const rec = plans.find((p) => p.id === RECOMMENDED_PLAN_ID) ?? plans[plans.length - 1];
  const price = `$${rec.priceMxn.toLocaleString("en-US")} MXN`;
  const mark = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#f5f7fb",
          backgroundImage:
            "radial-gradient(circle at 8% -10%, rgba(31,111,209,0.20), rgba(31,111,209,0) 45%), radial-gradient(circle at 100% 0%, rgba(255,163,26,0.20), rgba(255,163,26,0) 35%)",
          fontFamily: "Sora",
          color: "#0b1b33",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={mark} width={64} height={64} />
            <div style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.025em" }}>NovaPhone</div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 22px",
              borderRadius: 999,
              backgroundColor: "#ffffff",
              border: "2px solid #dfe6ef",
              fontSize: 26,
              fontWeight: 600,
              color: "#0a4fa3",
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: "#ffa31a" }} />
            Red Telcel 5G
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "#0a4fa3" }}>eSIM de datos para México</div>
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              maxWidth: 900,
            }}
          >
            Internet para tu celular en 2 minutos.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14, fontSize: 26, fontWeight: 400, color: "#44536a" }}>
            QR al instante · Sin contrato · Tarjeta o SPEI
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              padding: "16px 28px",
              borderRadius: 20,
              backgroundColor: "#0a4fa3",
              color: "#ffffff",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 400 }}>{`${rec.dataGb} GB por`}</div>
            <div style={{ fontSize: 44, fontWeight: 600 }}>{price}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Sora", data: semibold, weight: 600, style: "normal" },
        { name: "Sora", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}

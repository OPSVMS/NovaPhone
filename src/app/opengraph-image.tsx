import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "NovaPhone — eSIM de datos en México · Red Telcel 5G";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand mark (same geometry as src/components/brand/logo.tsx), as a data URI for Satori.
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7C3AED"/><stop offset=".55" stop-color="#A78BFA"/><stop offset="1" stop-color="#E4DEFF"/></linearGradient></defs><g fill="none" stroke="url(#g)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 51V13L24.22 24.22"/><path d="M51 13V51L39.78 39.78"/></g><circle cx="32" cy="32" r="4.5" fill="#7DE3F4"/></svg>`;

export default async function Image() {
  const fontDir = join(process.cwd(), "src/assets/fonts");
  const [semibold, regular] = await Promise.all([
    readFile(join(fontDir, "Sora-SemiBold.ttf")),
    readFile(join(fontDir, "Sora-Regular.ttf")),
  ]);
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
          padding: "72px 80px",
          backgroundColor: "#07050d",
          backgroundImage:
            "radial-gradient(circle at 12% -10%, rgba(118,82,240,0.55), rgba(118,82,240,0) 45%), radial-gradient(circle at 80% 45%, rgba(118,82,240,0.38), rgba(118,82,240,0) 38%), radial-gradient(circle at 95% 110%, rgba(125,227,244,0.16), rgba(125,227,244,0) 40%)",
          position: "relative",
          fontFamily: "Sora",
          color: "#f5f3ff",
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          src={mark}
          width={340}
          height={340}
          style={{ position: "absolute", right: 70, top: 120, opacity: 0.95 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img src={mark} width={72} height={72} />
          <div style={{ fontSize: 46, fontWeight: 600, letterSpacing: "-0.025em" }}>NovaPhone</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1.04,
              maxWidth: 760,
              backgroundImage: "linear-gradient(180deg, #ffffff 10%, #c4b5fd 120%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Datos móviles en minutos. Sin chip.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 400, color: "#a39db8" }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                backgroundColor: "#7de3f4",
                boxShadow: "0 0 18px 2px rgba(125,227,244,0.6)",
              }}
            />
            eSIM de datos en México · Red Telcel 5G
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

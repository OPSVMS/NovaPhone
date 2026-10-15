import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

function metadataBase(): URL {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: {
    default: "NovaPhone — eSIM de datos para México en red Telcel 5G",
    template: "%s · NovaPhone",
  },
  description:
    "eSIM de datos para México en red Telcel 5G. Actívala en 2 minutos con un QR, sin contrato. Paga con tarjeta o SPEI.",
  applicationName: "NovaPhone",
  keywords: ["eSIM México", "eSIM Telcel", "chip virtual", "eSIM de datos", "internet para celular sin contrato", "NovaPhone"],
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "NovaPhone",
  },
  twitter: {
    card: "summary_large_image",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f7fb",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${geist.variable} ${geistMono.variable} ${sora.variable} h-full`}
    >
      <body className="min-h-full bg-bg font-sans text-fg antialiased">
        <MotionProvider>{children}</MotionProvider>
        <Analytics />
      </body>
    </html>
  );
}

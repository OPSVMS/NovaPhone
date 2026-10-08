import { CreditCard, QrCode, ShoppingBag, UserRound } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Section, SectionHeader } from "@/components/ui/section";

const steps = [
  {
    icon: UserRound,
    title: "Crea tu cuenta",
    body: "Solo nombre, correo y contraseña. Sin CURP, sin INE, sin documentos.",
  },
  {
    icon: CreditCard,
    title: "Agrega saldo",
    body: "Recarga por transferencia SPEI o con USDT (TRC20). Tu saldo queda en tu cuenta.",
  },
  {
    icon: ShoppingBag,
    title: "Compra tu plan",
    body: "Elige tus datos y paga con tu saldo. Recibes la eSIM al instante en tu correo y en tu panel.",
  },
  {
    icon: QrCode,
    title: "Escanea e instala",
    body: "Escanea el QR o, en iPhone con iOS 17.4 o superior, instálala con un toque. Solo una vez: después recargas desde tu panel.",
  },
];

export function HowItWorks() {
  return (
    <Section id="como-funciona" className="scroll-mt-16">
      <FadeIn>
        <SectionHeader
          eyebrow="Cómo funciona"
          title="Cuatro pasos. Cero tiendas."
          description="De tu correo a navegar en 5G en lo que tardas en servirte un café."
        />
      </FadeIn>

      <div className="relative mt-12 sm:mt-16">
      {/* connecting hairline (desktop) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[12%] right-[12%] top-[2.75rem] hidden h-px bg-linear-to-r from-transparent via-lavender/30 to-transparent lg:block"
      />
      <Stagger as="ol" gap={0.08} className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {steps.map(({ icon: Icon, title, body }, i) => (
          <StaggerItem as="li" key={title} className="relative">
            <div className="flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="relative grid size-11 place-items-center rounded-control border border-lavender/20 bg-surface-2 text-lavender shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05)]">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="font-mono text-xs tabular-nums text-subtle">0{i + 1}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold leading-tight text-fg">{title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
      </div>

      <FadeIn className="mx-auto mt-8 max-w-2xl">
        <p className="rounded-card border border-dashed border-border-strong px-5 py-4 text-center text-sm leading-relaxed text-muted">
          <span className="font-medium text-fg">Un detalle importante:</span> activa{" "}
          <span className="text-lavender-soft">“Roaming de datos”</span> en la línea NovaPhone. Es normal: técnicamente
          es una eSIM internacional, pero navegas en México sin cargos extra.
        </p>
      </FadeIn>
    </Section>
  );
}

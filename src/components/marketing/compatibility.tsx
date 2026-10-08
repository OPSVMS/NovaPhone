import { Check, LockOpen, Smartphone } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";

const devices = [
  { brand: "iPhone", models: "XS, XR o posterior (incluye SE 2.ª gen. y más nuevos)" },
  { brand: "Google Pixel", models: "Pixel 3 o posterior" },
  { brand: "Samsung Galaxy", models: "S20 o posterior, Z Flip y Z Fold" },
  { brand: "Y muchos más", models: "Motorola, Xiaomi, OPPO y otros modelos recientes con eSIM" },
];

const checks = [
  {
    title: "En iPhone",
    body: "Ajustes → General → Información. Si aparece “EID” o “SIM digital”, tu iPhone es compatible.",
  },
  {
    title: "En Android",
    body: "Marca *#06#. Si ves un número “EID”, tu equipo soporta eSIM.",
  },
];

export function Compatibility() {
  return (
    <Section id="compatibilidad" className="scroll-mt-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
        <FadeIn>
          <SectionHeader
            align="left"
            eyebrow="Compatibilidad"
            title="¿Tu teléfono es compatible?"
            description="Necesitas un equipo con eSIM y desbloqueado (libre de compañía). La mayoría de los teléfonos de gama media y alta de los últimos años ya lo son."
          />
          <div className="mt-8 flex items-start gap-3 rounded-card border border-border bg-surface p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-control border border-lavender/20 bg-primary/10 text-lavender">
              <LockOpen aria-hidden className="size-[18px]" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-sans text-[15px] font-medium tracking-normal text-fg">Equipo desbloqueado</h3>
              <p className="text-sm leading-relaxed text-muted">
                Si compraste tu teléfono con un plan de renta, confirma con tu compañía que esté liberado antes de comprar.
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1} className="flex flex-col gap-4">
          <ul className="overflow-hidden rounded-card border border-border bg-surface">
            {devices.map((d) => (
              <li
                key={d.brand}
                className="flex items-start gap-3 border-b border-border px-5 py-4 last:border-b-0 sm:items-center sm:px-6"
              >
                <Smartphone aria-hidden className="mt-0.5 size-[18px] shrink-0 text-subtle sm:mt-0" />
                <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-[15px] font-medium text-fg">{d.brand}</span>
                  <span className="text-sm text-muted sm:text-right">{d.models}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-2">
            {checks.map((c) => (
              <div key={c.title} className="flex flex-col gap-2 rounded-card border border-dashed border-border-strong p-5">
                <h3 className="inline-flex items-center gap-2 font-sans text-sm font-medium tracking-normal text-fg">
                  <Check aria-hidden className="size-4 text-lavender" />
                  {c.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-subtle">
            Algunos modelos vendidos en ciertos países no incluyen eSIM. Ante la duda, revisa con el fabricante.
          </p>
        </FadeIn>
      </div>
    </Section>
  );
}

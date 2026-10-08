import { Headset, Landmark, Mail, Zap } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Section, SectionHeader } from "@/components/ui/section";

/* --- Small, decorative visuals inside the feature cards (aria-hidden) --- */

function CoverageVisual() {
  const bars = [28, 44, 62, 82, 100];
  return (
    <div aria-hidden className="flex h-24 items-end gap-2">
      {bars.map((h, i) => (
        <span
          key={h}
          className="w-3 rounded-full bg-linear-to-t from-primary/50 to-lavender transition-[height] duration-500 ease-out-expo"
          style={{ height: `${h}%`, opacity: 0.45 + i * 0.13 }}
        />
      ))}
      <span className="mb-1 ml-2 font-display text-2xl font-semibold tracking-tight text-fg">5G</span>
    </div>
  );
}

function SignupVisual() {
  const rows = [
    { label: "Nombre", ok: true },
    { label: "Correo", ok: true },
    { label: "Contraseña", ok: true },
    { label: "CURP / INE", ok: false },
  ];
  return (
    <ul aria-hidden className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li
          key={r.label}
          className={
            r.ok
              ? "flex h-8 items-center justify-between rounded-[10px] border border-border bg-surface-2 px-3 text-xs text-muted"
              : "flex h-8 items-center justify-between rounded-[10px] border border-dashed border-border-strong px-3 text-xs text-subtle line-through decoration-subtle/60"
          }
        >
          {r.label}
          <span className={r.ok ? "size-1.5 rounded-full bg-lavender" : "text-[11px] no-underline"}>
            {r.ok ? null : "No"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FreedomVisual() {
  return (
    <div aria-hidden className="flex flex-wrap gap-2">
      {["Sin contrato", "Sin plazos forzosos", "Sin renta mensual", "Datos 5G"].map((t) => (
        <span
          key={t}
          className="inline-flex h-8 items-center rounded-full border border-border bg-white/[0.03] px-3 text-xs text-muted"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

const pillars = [
  {
    eyebrow: "Cobertura",
    title: "Conectado a la red Telcel 5G",
    body: "La mayor cobertura del país, con AT&T 5G como respaldo. Donde tu equipo no tenga 5G, navegas en 4G LTE.",
    visual: <CoverageVisual />,
  },
  {
    eyebrow: "Privacidad",
    title: "Sin registros ni papeleo",
    body: "Activa con tu correo. No pedimos CURP, INE ni documentos: solo nombre, correo y contraseña.",
    visual: <SignupVisual />,
  },
  {
    eyebrow: "Libertad",
    title: "Navega sin restricciones",
    body: "Datos 5G de prepago. Sin contratos, sin plazos forzosos: compras cuando lo necesitas y listo.",
    visual: <FreedomVisual />,
  },
];

const extras = [
  { icon: Zap, title: "Activación instantánea", body: "Tu eSIM llega al momento a tu correo y a tu panel." },
  { icon: Landmark, title: "Paga con SPEI o USDT", body: "Recarga saldo por transferencia o con USDT (TRC20)." },
  { icon: Headset, title: "Soporte humano", body: "Personas reales te ayudan a instalar y resolver dudas." },
  { icon: Mail, title: "Solo tu correo", body: "Tu cuenta, tu saldo y tus eSIMs en un solo panel." },
];

export function ValueProps() {
  return (
    <Section id="beneficios">
      <FadeIn>
        <SectionHeader
          eyebrow="Por qué NovaPhone"
          title="Datos sin fricción, de verdad"
          description="Todo lo bueno de una línea de datos, sin las filas, los contratos ni las fotocopias."
        />
      </FadeIn>

      <Stagger className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-3 md:gap-6">
        {pillars.map((p) => (
          <StaggerItem key={p.title} className="h-full">
            <article className="group relative flex h-full flex-col justify-between gap-8 overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card transition-[border-color,background-color] duration-300 ease-out-expo hover:border-border-strong sm:p-6">
              <div className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(118_82_240/0.18),transparent)] opacity-0 transition-opacity duration-500 ease-out-expo group-hover:opacity-100" />
              <div className="min-h-24">{p.visual}</div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-lavender">{p.eyebrow}</span>
                <h3 className="text-xl font-semibold leading-tight text-fg">{p.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{p.body}</p>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      <Stagger as="ul" className="mt-4 grid gap-4 sm:grid-cols-2 md:mt-6 md:gap-6 lg:grid-cols-4">
        {extras.map(({ icon: Icon, title, body }) => (
          <StaggerItem as="li" key={title}>
            <div className="flex h-full gap-4 rounded-card border border-border p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-control border border-lavender/20 bg-primary/10 text-lavender">
                <Icon aria-hidden className="size-[18px]" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-sans text-[15px] font-medium tracking-normal text-fg">{title}</h3>
                <p className="text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
}

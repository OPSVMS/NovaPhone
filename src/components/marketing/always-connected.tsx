import { Gauge, Landmark, RefreshCw, Zap } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Section, SectionHeader } from "@/components/ui/section";
import { RefillMeter } from "./refill-meter";

const features = [
  {
    icon: RefreshCw,
    title: "Recarga la misma eSIM",
    body: "¿Se te acabaron los datos? Recarga desde tu panel y se suman datos y días a tu misma eSIM, al instante. Sin reinstalar ni escanear otro QR.",
  },
  {
    icon: Zap,
    title: "Auto-recarga",
    body: "Actívala y, cuando te queden menos de 500 MB o 2 días, recargamos con tu saldo y te avisamos por correo. Nunca te quedas sin internet.",
  },
  {
    icon: Gauge,
    title: "Consumo y vigencia en tu panel",
    body: "Ve cuántos datos y cuántos días te quedan, actualizado varias veces al día.",
  },
  {
    icon: Landmark,
    title: "Tu CLABE personal",
    soon: true,
    body: "Transfiere cuando quieras o programa un pago mensual en tu banco: tu saldo se acredita solo, sin referencias. Con auto-recarga, es una suscripción sin tarjeta.",
  },
];

/** Landing block: recargas en la misma eSIM, auto-recarga y pago recurrente. */
export function AlwaysConnected() {
  return (
    <Section id="recargas" className="scroll-mt-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-10">
          <FadeIn>
            <SectionHeader
              align="left"
              eyebrow="Siempre conectado"
              title="Recarga sin cambiar de eSIM"
              description="Instalas una vez y listo. Cuando necesites más datos, se suman a la misma eSIM, o deja que la auto-recarga lo haga por ti."
            />
          </FadeIn>

          <Stagger as="ul" className="grid gap-6 sm:grid-cols-2 sm:gap-x-8">
            {features.map(({ icon: Icon, title, body, soon }) => (
              <StaggerItem as="li" key={title} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-control border border-lavender/20 bg-primary/10 text-lavender">
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <h3 className="font-sans text-[15px] font-medium tracking-normal text-fg">{title}</h3>
                  {soon ? <Badge className="ml-auto sm:ml-0">Próximamente</Badge> : null}
                </div>
                <p className="text-sm leading-relaxed text-muted">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <FadeIn delay={0.1} className="pb-4">
          <RefillMeter />
        </FadeIn>
      </div>
    </Section>
  );
}

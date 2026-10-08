import { ArrowRight, MessageSquareText } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import { formatPesos } from "./format";
import { AUTH_LINKS } from "./nav";
import { NumberInboxVisual } from "./number-inbox-visual";

/** Registro que lleva directo a /app/numero. */
export const NUMBER_SIGNUP_HREF = `${AUTH_LINKS.signup}?next=${encodeURIComponent("/app/numero")}`;

const steps = ["Actívalo en tu panel", "Úsalo al registrarte en WhatsApp o Telegram", "El código llega a tu panel y a tu correo"];

/** Landing block: número del Reino Unido para recibir SMS y códigos. */
export function NumberSection({ priceMxn }: { priceMxn: number }) {
  return (
    <Section id="numero" className="scroll-mt-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-8">
          <FadeIn>
            <SectionHeader
              align="left"
              eyebrow="Número NovaPhone"
              title="Tu número para verificar apps"
              description="Un número móvil del Reino Unido (+44) para recibir SMS y códigos de verificación. Sin chip y sin contrato."
            />
          </FadeIn>

          <Stagger as="ol" className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <StaggerItem as="li" key={s} className="flex items-center gap-3 text-[15px] text-fg">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-lavender/25 bg-primary/10 font-display text-[13px] font-semibold text-lavender tabular-nums">
                  {i + 1}
                </span>
                {s}
              </StaggerItem>
            ))}
          </Stagger>

          <FadeIn delay={0.1} className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <p className="flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-semibold tracking-tight text-fg tabular-nums">
                  {formatPesos(priceMxn)}
                </span>
                <span className="text-sm text-muted">MXN/mes</span>
              </p>
              <Button href={NUMBER_SIGNUP_HREF} size="lg" className="w-full sm:w-auto">
                Agregar número
                <ArrowRight className="transition-transform duration-200 ease-out-expo group-hover/button:translate-x-0.5" />
              </Button>
            </div>
            <p className="text-[13px] leading-relaxed text-subtle">
              Se paga con tu saldo y se renueva cada 30 días; cancela cuando quieras. Por ahora recibe SMS (las llamadas
              llegan muy pronto). Algunas apps o bancos no aceptan números virtuales.
            </p>
          </FadeIn>
        </div>

        <FadeIn delay={0.1} className="pb-4">
          <NumberInboxVisual />
        </FadeIn>
      </div>
    </Section>
  );
}

/** Tarjeta de complemento para /planes. */
export function NumberAddonCard({ priceMxn }: { priceMxn: number }) {
  return (
    <section
      aria-labelledby="complemento-numero"
      className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-control border border-lavender/20 bg-primary/10 text-lavender">
          <MessageSquareText aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <Badge variant="primary" className="w-fit">
            Complemento
          </Badge>
          <h2 id="complemento-numero" className="text-lg font-semibold text-fg">
            Número NovaPhone · {formatPesos(priceMxn)}/mes
          </h2>
          <p className="max-w-[56ch] text-sm leading-relaxed text-muted">
            Un número del Reino Unido (+44) para recibir SMS y códigos de WhatsApp, Telegram y otras apps, en tu panel y
            en tu correo. Funciona con o sin eSIM.
          </p>
        </div>
      </div>
      <Button href={NUMBER_SIGNUP_HREF} variant="secondary" className="w-full shrink-0 sm:w-auto">
        Agregar número
      </Button>
    </section>
  );
}

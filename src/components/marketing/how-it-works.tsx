import { CreditCard, QrCode, Wifi } from "lucide-react";
import { Container } from "@/components/ui/container";

const steps = [
  {
    icon: CreditCard,
    title: "Elige tu plan y paga",
    body: "Con tarjeta, Apple Pay, Google Pay o SPEI.",
  },
  {
    icon: QrCode,
    title: "Escanea el QR",
    body: "Te llega al instante a tu correo. Se instala en 2 minutos.",
  },
  {
    icon: Wifi,
    title: "Navega en red Telcel 5G",
    body: "Tus días empiezan a contar cuando te conectas por primera vez.",
  },
];

/** "¿Cómo lo activo?" in three steps. */
export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-16 border-y border-border bg-surface py-12 sm:py-16">
      <Container className="flex flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 id="como-funciona-titulo" className="text-3xl font-bold text-fg sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="text-[17px] leading-relaxed text-muted lg:hidden">
            Una eSIM es una SIM digital que se instala con un QR, sin chip físico. Tu chip actual sigue funcionando.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3 sm:gap-5">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex items-start gap-4 rounded-card border border-border bg-bg p-5 sm:flex-col sm:gap-4 sm:p-6">
              <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <Icon aria-hidden className="size-6" />
                <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-marigold font-display text-[13px] font-bold text-fg tabular-nums ring-2 ring-bg">
                  {i + 1}
                </span>
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-fg">{title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

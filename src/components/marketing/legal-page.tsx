import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion/fade-in";
import { Container } from "@/components/ui/container";
import { WHATSAPP_URL } from "./whatsapp";

export type LegalSection = { title: string; body: ReactNode };

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="relative isolate">
      <Container size="sm" className="py-16 sm:py-24">
        <FadeIn immediate>
          <header className="flex flex-col items-start gap-4 border-b border-border pb-8">
            <h1 className="text-4xl font-bold leading-tight text-fg sm:text-5xl">{title}</h1>
            <p className="text-[13px] text-subtle">Última actualización: {updated}</p>
            <div className="text-base leading-relaxed text-muted">{intro}</div>
          </header>
        </FadeIn>

        <ol className="mt-10 flex flex-col gap-10">
          {sections.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3">
              <h2 className="flex items-baseline gap-3 text-xl font-semibold text-fg">
                <span className="font-mono text-sm tabular-nums text-subtle">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted [&_a]:font-medium [&_a]:text-link [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
                {s.body}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-14 rounded-card border border-border bg-surface p-5 text-sm leading-relaxed text-muted">
          NovaPhone es operado por MASMOVIL S.A. de C.V., Guadalajara, Jalisco, México. ¿Dudas? Escríbenos por{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-link hover:underline">
            WhatsApp
          </a>
          .
        </p>
      </Container>
    </div>
  );
}

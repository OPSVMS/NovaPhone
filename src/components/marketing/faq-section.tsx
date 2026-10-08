import { FadeIn } from "@/components/motion/fade-in";
import { Section, SectionHeader } from "@/components/ui/section";
import { FaqAccordion } from "./faq-accordion";
import { FAQ, type FaqItem } from "./faq-data";

function faqJsonLd(items: FaqItem[]) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  }).replace(/</g, "\\u003c");
}

export function FaqSection({ items = FAQ }: { items?: FaqItem[] }) {
  return (
    <Section id="preguntas" container="md" className="scroll-mt-16">
      <FadeIn>
        <SectionHeader
          eyebrow="Preguntas frecuentes"
          title="Lo que todos preguntan"
          description="¿Te quedó alguna duda? Nuestro equipo de soporte humano te responde."
        />
      </FadeIn>
      <FadeIn delay={0.08} className="mt-12 sm:mt-16">
        <FaqAccordion items={items} />
      </FadeIn>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(items) }} />
    </Section>
  );
}

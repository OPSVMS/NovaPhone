import { Container } from "@/components/ui/container";
import { FaqAccordion } from "./faq-accordion";
import { FAQ, type FaqItem } from "./faq-data";
import { WhatsAppIcon, WhatsAppLink } from "./whatsapp";

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
    <section id="preguntas" aria-labelledby="preguntas-titulo" className="scroll-mt-16 py-12 sm:py-16">
      <Container size="md" className="flex flex-col gap-6">
        <h2 id="preguntas-titulo" className="text-3xl font-bold text-fg sm:text-4xl">
          Preguntas frecuentes
        </h2>
        <FaqAccordion items={items} defaultOpen={null} />
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-fg">
            <span className="font-semibold">¿Otra duda?</span> Te respondemos por WhatsApp.
          </p>
          <WhatsAppLink
            className="inline-flex h-11 items-center gap-2 rounded-control bg-whatsapp px-4 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            testId="faq-whatsapp"
          >
            <WhatsAppIcon className="size-5" />
            Escribir por WhatsApp
          </WhatsAppLink>
        </div>
      </Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(items) }} />
    </section>
  );
}

import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { Container } from "@/components/ui/container";
import { formatMxn } from "./format";
import { AUTH_LINKS } from "./nav";

/** Signup that lands straight on /app/numero. */
export const NUMBER_SIGNUP_HREF = `${AUTH_LINKS.signup}?next=${encodeURIComponent("/app/numero")}`;

/** Optional +44 number, one compact card (the landing sells data first). */
export function NumberAddon({ priceMxn }: { priceMxn: number }) {
  return (
    <section aria-labelledby="numero-titulo" id="numero" className="scroll-mt-16 pt-12 sm:pt-16">
      <Container size="md">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-card border border-border bg-surface p-5 shadow-card sm:flex-nowrap sm:items-center sm:gap-6 sm:p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-marigold-soft text-marigold-ink sm:size-12">
            <MessageSquareText aria-hidden className="size-6" />
          </span>
          <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
            <h2 id="numero-titulo" className="text-lg font-semibold text-fg">
              Tu número para verificar apps <span className="font-sans text-sm font-medium text-muted">(opcional)</span>
            </h2>
            <p className="text-[15px] leading-relaxed text-muted">
              Un número +44 para recibir SMS y códigos. <span className="font-semibold text-fg tabular-nums">{formatMxn(priceMxn)}</span>{" "}
              cada 30 días. Cancela cuando quieras.
            </p>
          </div>
          <Link
            href={NUMBER_SIGNUP_HREF}
            className="ml-[3.75rem] inline-flex h-11 w-fit shrink-0 items-center gap-1.5 text-[15px] font-semibold text-link hover:text-link-hover sm:ml-0"
          >
            Agregar número
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

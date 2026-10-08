import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { formatGb } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { formatDays, formatPerGb, formatPesos } from "./format";
import { planHref } from "./nav";
import type { MarketingPlan } from "./plans-data";

/** Side-by-side comparison. Scrolls inside its own container on narrow screens. */
export function PlansTable({ plans }: { plans: MarketingPlan[] }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <caption className="sr-only">Comparativa de planes de datos NovaPhone</caption>
        <thead>
          <tr className="border-b border-border text-[13px] text-subtle">
            <th scope="col" className="px-5 py-3.5 font-medium sm:px-6">Datos</th>
            <th scope="col" className="px-4 py-3.5 font-medium">Vigencia</th>
            <th scope="col" className="px-4 py-3.5 text-right font-medium">Precio</th>
            <th scope="col" className="px-4 py-3.5 text-right font-medium">Por GB</th>
            <th scope="col" className="px-5 py-3.5 sm:px-6">
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr
              key={p.id}
              className={clsx(
                "border-b border-border transition-colors duration-200 last:border-b-0 hover:bg-white/[0.02]",
                p.featured && "bg-primary/[0.06] hover:bg-primary/[0.08]",
              )}
            >
              <th scope="row" className="px-5 py-4 font-medium sm:px-6">
                <span className="flex items-center gap-2.5">
                  <span className="font-display text-base font-semibold tabular-nums text-fg">{formatGb(p.dataGb)}</span>
                  {p.featured ? <Badge variant="primary">Más popular</Badge> : null}
                </span>
              </th>
              <td className="px-4 py-4 tabular-nums text-muted">{formatDays(p.days)}</td>
              <td className="px-4 py-4 text-right font-display text-base font-semibold tabular-nums text-fg">
                {formatPesos(p.priceMxn)}
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-subtle">{formatPerGb(p.priceMxn, p.dataGb)}</td>
              <td className="px-5 py-2 text-right sm:px-6">
                <Link
                  href={planHref(p.id)}
                  aria-label={`Elegir plan de ${formatGb(p.dataGb)} por ${formatDays(p.days)}`}
                  className="group inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium text-lavender transition-colors duration-200 hover:bg-primary/10 hover:text-lavender-soft"
                >
                  Elegir
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

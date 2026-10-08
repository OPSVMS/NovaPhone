import clsx from "clsx";
import { ArrowRight, Check } from "lucide-react";
import { formatGb } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDays, formatPerGb, formatPesos } from "./format";
import { planHref } from "./nav";
import type { MarketingPlan } from "./plans-data";

function features(plan: MarketingPlan) {
  const has5g = /5g/i.test(`${plan.networks} ${plan.speed}`) || !plan.networks;
  return [
    has5g ? "Red Telcel 5G · respaldo AT&T" : "Red Telcel · respaldo AT&T",
    `${formatDays(plan.days)} desde tu primera conexión`,
    "Entrega instantánea por correo",
    "Solo datos, sin número ni SMS",
  ];
}

export function PlanCard({ plan, headingLevel = "h3" }: { plan: MarketingPlan; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const featured = plan.featured;
  return (
    <article
      className={clsx(
        "group relative flex h-full flex-col rounded-card p-5 transition-[transform,border-color,background-color,box-shadow] duration-300 ease-out-expo sm:p-6",
        "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
        featured
          ? "border-gradient glow"
          : "border border-border bg-surface shadow-card hover:border-border-strong",
      )}
    >
      {featured ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 -top-px h-px bg-linear-to-r from-transparent via-lavender-soft to-transparent"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <Heading className="font-display text-3xl font-semibold tabular-nums leading-none tracking-tight text-fg">
            {formatGb(plan.dataGb)}
          </Heading>
          <p className="mt-2 text-sm text-muted">{formatDays(plan.days)}</p>
        </div>
        {featured ? <Badge variant="primary">Más popular</Badge> : null}
      </div>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-semibold tabular-nums tracking-tight text-fg">
          {formatPesos(plan.priceMxn)}
        </span>
        <span className="text-sm text-muted">MXN</span>
      </div>
      <p className="mt-1 text-[13px] tabular-nums text-subtle">≈ {formatPerGb(plan.priceMxn, plan.dataGb)} por GB · IVA incluido</p>

      <ul className="mt-6 flex flex-col gap-2.5 border-t border-border pt-5 text-sm text-muted">
        {features(plan).map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check aria-hidden className={clsx("mt-0.5 size-4 shrink-0", featured ? "text-lavender" : "text-subtle")} />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <Button
          href={planHref(plan.id)}
          variant={featured ? "primary" : "secondary"}
          fullWidth
          aria-label={`Elegir plan de ${formatGb(plan.dataGb)} por ${formatDays(plan.days)}, ${formatPesos(plan.priceMxn)}`}
        >
          Elegir plan
          <ArrowRight className="transition-transform duration-200 ease-out-expo group-hover/button:translate-x-0.5" />
        </Button>
      </div>
    </article>
  );
}

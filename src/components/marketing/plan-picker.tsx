"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, BadgeCheck, ChevronDown, CircleAlert, Lock, Star } from "lucide-react";
import { startCardCheckout } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { formatDays, formatMxn, formatPesos } from "./format";
import { flushFunnel, funnel, ga } from "./funnel";
import type { MarketingPlan } from "./plans-data";
import { WhatsAppIcon, WhatsAppLink } from "./whatsapp";

type PickerPlan = Pick<MarketingPlan, "id" | "dataGb" | "days" | "priceMxn" | "featured">;
type Status = "idle" | "submitting" | "soon";

const SOON_MESSAGE = "Pago con tarjeta disponible en minutos";
const ERROR_MESSAGE = "No pudimos abrir el pago. No se hizo ningún cargo. Intenta de nuevo o paga con SPEI.";

/** SPEI / existing-account flow: the app buys with wallet balance (redirects to /entrar when signed out). */
const noopSubscribe = () => () => {};

const speiHref = (planId: string) => `/app/comprar?plan=${encodeURIComponent(planId)}`;

/**
 * Landing buy box (the Google Ads destination), deliberately short:
 * 3 plans (recommended preselected, in the middle) → "Ver más planes" → "Comprar ahora" → Stripe Checkout
 * via `startCardCheckout` (Stripe asks for the email; no email step here).
 * Mobile: sticky "Comprar ahora — $599 MXN" bar, hidden while the buy button itself is on screen.
 */
export function PlanPicker({
  plans,
  visibleIds,
  recommendedId,
  expanded = false,
}: {
  plans: PickerPlan[];
  /** Plans shown before "Ver más planes", in display order. */
  visibleIds: readonly string[];
  recommendedId: string;
  /** Start with every plan visible (used on /planes). */
  expanded?: boolean;
}) {
  const recommended = plans.find((p) => p.id === recommendedId) ?? plans.find((p) => p.featured) ?? plans[0];
  const [selectedId, setSelectedId] = useState(recommended?.id);
  const [showAll, setShowAll] = useState(expanded);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [buyVisible, setBuyVisible] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  // The sticky bar is portalled to <body> so no ancestor stacking context (e.g. the hero's `isolate`) can trap it.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const selected = plans.find((p) => p.id === selectedId) ?? recommended;
  const short = visibleIds.map((id) => plans.find((p) => p.id === id)).filter((p): p is PickerPlan => !!p);
  const shortList = short.length ? short : plans.slice(0, 3);
  const rest = plans.filter((p) => !shortList.includes(p));
  const shown = showAll ? [...shortList, ...rest] : shortList;

  // Restore a selection after a cancelled checkout or a deep link (?plan=MX_10_30&cancelled=1).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fromUrl = plans.find((p) => p.id === q.get("plan"));
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from the URL */
    if (fromUrl) {
      setSelectedId(fromUrl.id);
      if (!shortList.includes(fromUrl)) setShowAll(true);
    }
    if (q.get("cancelled") === "1") setCancelled(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    ga.viewList(shortList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide the sticky mobile bar while the in-page buy button is visible.
  useEffect(() => {
    const el = buttonRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBuyVisible(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!selected) return null;

  function choose(p: PickerPlan) {
    setSelectedId(p.id);
    setError(null);
    funnel("plan_select", { plan: p.id, price: p.priceMxn, gb: p.dataGb, days: p.days });
    ga.select(p);
  }

  async function buy(source: "panel" | "sticky") {
    if (!selected || status === "submitting") return;
    setError(null);
    funnel("buy_click", { plan: selected.id, price: selected.priceMxn, source });
    setStatus("submitting");
    try {
      const res = await startCardCheckout({ planId: selected.id });
      if (res && "url" in res && res.url) {
        funnel("checkout_redirect", { plan: selected.id, price: selected.priceMxn, source });
        ga.beginCheckout(selected);
        flushFunnel();
        window.location.assign(res.url);
        return;
      }
      const code = res && "code" in res ? String(res.code) : "unknown";
      funnel("buy_error", { plan: selected.id, source, code });
      if (code === "payments_disabled") {
        setStatus("soon");
        return;
      }
      setError(res && "error" in res && res.error ? String(res.error) : ERROR_MESSAGE);
      setStatus("idle");
    } catch {
      // The card checkout action is not deployed yet (or failed before reaching Stripe).
      funnel("buy_error", { plan: selected.id, source, code: "exception" });
      setStatus("soon");
    }
  }

  const ctaLabel = `Comprar ahora — ${formatMxn(selected.priceMxn)}`;

  return (
    <div className="flex flex-col gap-4" data-testid="plan-picker">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id="planes-titulo" className="text-xl font-bold text-fg sm:text-2xl">
          Elige tus datos
        </h2>
        <p className="text-[13px] text-muted">Precios en pesos, IVA incluido</p>
      </div>

      {cancelled ? (
        <p className="rounded-xl bg-primary/[0.06] px-3.5 py-2.5 text-sm text-fg" role="status">
          No se hizo ningún cargo. Tu plan sigue elegido.
        </p>
      ) : null}

      <div role="radiogroup" aria-labelledby="planes-titulo" className="flex flex-col gap-2.5">
        {shown.map((p) => {
          const active = p.id === selected.id;
          const isRec = p.id === recommended?.id;
          return (
            <label
              key={p.id}
              data-testid={`plan-${p.id}`}
              data-selected={active || undefined}
              className={clsx(
                "relative flex min-h-[4.5rem] cursor-pointer items-center gap-3.5 rounded-2xl border bg-surface px-4 py-3.5 transition-[border-color,box-shadow,background-color] duration-200 ease-out-expo",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/25",
                active
                  ? "border-primary bg-primary/[0.035] shadow-raised ring-1 ring-primary"
                  : "border-border shadow-card hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={p.id}
                checked={active}
                onChange={() => choose(p)}
                className="sr-only"
                aria-label={`${p.dataGb} GB, ${formatDays(p.days)}, ${formatMxn(p.priceMxn)}${isRec ? ", recomendado" : ""}`}
              />
              <span
                aria-hidden
                className={clsx(
                  "grid size-[22px] shrink-0 place-items-center rounded-full border-2 bg-surface transition-colors",
                  active ? "border-primary" : "border-border-strong",
                )}
              >
                {active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-xl font-bold leading-tight text-fg tabular-nums">{p.dataGb} GB</span>
                  {isRec ? (
                    <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-marigold px-2 text-[11px] font-bold uppercase tracking-wide text-fg">
                      <Star aria-hidden className="size-3 fill-current" strokeWidth={0} />
                      Recomendado
                    </span>
                  ) : null}
                </span>
                <span className="text-[13px] text-muted tabular-nums">
                  {formatDays(p.days)}
                  {p.dataGb >= 5 ? ` · ${formatPesos(Math.round(p.priceMxn / p.dataGb))} por GB` : null}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end leading-none">
                <span className="font-display text-2xl font-bold text-fg tabular-nums" data-testid={`price-${p.id}`}>
                  {formatPesos(p.priceMxn)}
                </span>
                <span className="mt-1 text-[11px] font-semibold tracking-wide text-muted">MXN</span>
              </span>
            </label>
          );
        })}
      </div>

      {rest.length && !expanded ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          data-testid="more-plans"
          className="-my-1 inline-flex h-11 w-fit items-center gap-1.5 rounded-control px-1 text-sm font-semibold text-link hover:text-link-hover"
        >
          {showAll ? "Ver menos planes" : `Ver más planes (desde ${formatMxn(Math.min(...rest.map((p) => p.priceMxn)))})`}
          <ChevronDown aria-hidden className={clsx("size-4 transition-transform", showAll && "rotate-180")} />
        </button>
      ) : null}

      <p className="text-[13px] leading-snug text-muted">
        Solo datos: navega, usa WhatsApp y redes. No incluye número ni llamadas.
      </p>

      <div ref={buyRef} id="comprar" className="flex scroll-mt-24 flex-col gap-3">
        {status === "soon" ? (
          <div className="flex flex-col gap-1 rounded-2xl border border-marigold/50 bg-marigold-soft p-4" role="status" data-testid="card-soon">
            <p className="font-semibold text-fg">{SOON_MESSAGE}</p>
            <p className="text-sm leading-relaxed text-muted">
              Mientras tanto, puedes pagar con SPEI desde tu cuenta o escribirnos por WhatsApp.
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/[0.07] p-3 text-sm text-danger" data-testid="buy-error">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        ) : null}

        <div ref={buttonRef}>
          <Button
            size="lg"
            fullWidth
            loading={status === "submitting"}
            onClick={() => void buy("panel")}
            data-testid="buy-button"
            className="h-14 text-[17px]"
          >
            <span className="tabular-nums">{ctaLabel}</span>
            <ArrowRight aria-hidden />
          </Button>
        </div>
        {status === "submitting" ? (
          <p className="text-center text-[13px] text-muted" aria-live="polite">
            Abriendo el pago seguro…
          </p>
        ) : null}

        <Link
          href="/reembolsos"
          className="flex items-center justify-center gap-1.5 text-center text-[13px] font-semibold text-success hover:underline"
          data-testid="guarantee"
        >
          <BadgeCheck aria-hidden className="size-4 shrink-0" />
          Garantía de conexión: si no logramos conectarte, te devolvemos el importe
        </Link>
        <p className="text-balance text-center text-[12px] leading-snug text-muted" data-testid="payment-row">
          <Lock aria-hidden className="mr-1 inline size-3.5 -translate-y-px align-middle text-success" />
          Pago seguro con Stripe · Visa, Mastercard, Amex, Apple Pay, Google Pay · o SPEI
        </p>

        <div className="flex flex-col items-center gap-2 border-t border-border pt-3">
          <Link
            href={speiHref(selected.id)}
            className="inline-flex min-h-10 items-center text-sm font-semibold text-link underline-offset-4 hover:underline"
            data-testid="spei-link"
          >
            Pagar con SPEI / ya tengo cuenta
          </Link>
          <p className="text-center text-[12px] leading-snug text-subtle">
            NovaPhone es operado por MASMOVIL S.A. de C.V., Guadalajara, Jalisco.
          </p>
        </div>
      </div>

      {/* Sticky mobile buy bar */}
      {mounted
        ? createPortal(
          <div
            aria-hidden={buyVisible}
            inert={buyVisible}
            className={clsx(
              "pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pt-2.5 shadow-[0_-10px_30px_-14px_rgb(11_27_51/0.3)] backdrop-blur-md transition-transform duration-300 ease-out-expo lg:hidden",
              buyVisible ? "translate-y-full" : "translate-y-0",
            )}
            data-testid="sticky-bar"
            data-sticky-bar={buyVisible ? "off" : "on"}
          >
            <div className="mx-auto flex max-w-xl flex-col gap-1.5 pb-2">
              <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted tabular-nums" data-testid="sticky-sub">
                <Lock aria-hidden className="size-3 shrink-0 text-success" />
                {selected.dataGb} GB · {formatDays(selected.days)} · Pago seguro · QR al instante
              </p>
              <div className="flex items-center gap-2">
                <WhatsAppLink
                  className="grid size-12 shrink-0 place-items-center rounded-control border border-border bg-surface text-whatsapp hover:bg-surface-2"
                  aria-label="Escríbenos por WhatsApp"
                  testId="sticky-whatsapp"
                >
                  <WhatsAppIcon className="size-6" />
                </WhatsAppLink>
                <Button
                  size="lg"
                  className="h-12 min-w-0 flex-1 px-3 text-[16px]"
                  loading={status === "submitting"}
                  onClick={() => {
                    if (status === "soon") buyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    else void buy("sticky");
                  }}
                  data-testid="sticky-buy"
                >
                  <span className="tabular-nums">{ctaLabel}</span>
                </Button>
              </div>
            </div>
          </div>,
            document.body,
          )
        : null}
    </div>
  );
}

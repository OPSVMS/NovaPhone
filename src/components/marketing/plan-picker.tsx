"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, BadgeCheck, CircleAlert, CircleHelp, Lock, Mail, Star } from "lucide-react";
import { startCardCheckout } from "@/app/actions/checkout";
import { Button } from "@/components/ui/button";
import { formatDays, formatMxn, formatPerGb, formatPesos } from "./format";
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

/** The cheap "try it first" plan (1 GB / 7 días): badged "Para probar" and named in the note under the list. */
const TRIAL_PLAN_ID = "MX_1_7";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_ERROR = "Escribe un correo válido para enviarte tu eSIM.";
/** Remembered for this tab only, so a cancelled Stripe checkout comes back with the email filled in. */
const EMAIL_KEY = "np_checkout_email";

/**
 * Landing buy box (the Google Ads destination), deliberately short:
 * every marketed plan as a compact one-line row (cheapest first, recommended 20 GB preselected and last,
 * 1 GB badged "Para probar") → email ("Correo para tu cuenta y tu QR", required) → optional number add-on
 * (checkbox, +$79 MXN / 30 días) → "Comprar ahora — $total" → Stripe Checkout via
 * `startCardCheckout({ planId, email, addNumber })`.
 * Mobile: sticky "Comprar ahora — $599 MXN" bar, shown only while the plan list and buy button are off screen
 * (so it never covers a plan).
 */
export function PlanPicker({
  plans: catalog,
  recommendedId,
  numberPriceMxn,
}: {
  plans: PickerPlan[];
  recommendedId: string;
  /** Price of the "número para recibir códigos" add-on (30 days); omit to hide the add-on. */
  numberPriceMxn?: number;
}) {
  const plans = [...catalog].sort((a, b) => a.dataGb - b.dataGb || a.days - b.days);
  const recommended = plans.find((p) => p.id === recommendedId) ?? plans.find((p) => p.featured) ?? plans.at(-1);
  const trial = plans.find((p) => p.id === TRIAL_PLAN_ID);
  const [selectedId, setSelectedId] = useState(recommended?.id);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [pickerOnScreen, setPickerOnScreen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [addNumber, setAddNumber] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const emailFocused = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const buyRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const zoneRef = useRef<HTMLDivElement>(null);
  // The sticky bar is portalled to <body> so no ancestor stacking context (e.g. the hero's `isolate`) can trap it.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const selected = plans.find((p) => p.id === selectedId) ?? recommended;

  // Restore a selection after a cancelled checkout or a deep link (?plan=MX_10_30&cancelled=1).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fromUrl = plans.find((p) => p.id === q.get("plan"));
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from the URL */
    if (fromUrl) setSelectedId(fromUrl.id);
    if (q.get("cancelled") === "1") setCancelled(true);
    try {
      const saved = sessionStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      // storage blocked: nothing to restore
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    ga.viewList(plans);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide the sticky mobile bar while any part of the plan list or the in-page buy button is on screen,
  // so the bar never sits on top of a plan.
  useEffect(() => {
    const el = zoneRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPickerOnScreen(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!selected) return null;

  const addon = typeof numberPriceMxn === "number" && numberPriceMxn > 0 ? numberPriceMxn : null;
  const total = selected.priceMxn + (addon && addNumber ? addon : 0);

  function choose(p: PickerPlan) {
    setSelectedId(p.id);
    setError(null);
    funnel("plan_select", { plan: p.id, price: p.priceMxn, gb: p.dataGb, days: p.days });
    ga.select(p);
  }

  function onEmailFocus() {
    if (emailFocused.current) return;
    emailFocused.current = true;
    funnel("email_focus", { plan: selected?.id });
  }

  function toggleAddon(on: boolean) {
    setAddNumber(on);
    funnel("addon_toggle", { on, plan: selected?.id, price: numberPriceMxn });
  }

  async function buy(source: "panel" | "sticky") {
    if (!selected || status === "submitting") return;
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setEmailError(EMAIL_ERROR);
      funnel("buy_error", { plan: selected.id, source, code: cleanEmail ? "email_invalid" : "email_missing" });
      const input = emailRef.current;
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
      return;
    }
    setEmailError(null);
    try {
      sessionStorage.setItem(EMAIL_KEY, cleanEmail);
    } catch {
      // storage blocked: fine
    }
    const withNumber = !!addon && addNumber;
    const props = { plan: selected.id, price: selected.priceMxn, addon: withNumber, total, source };
    funnel("buy_click", props);
    setStatus("submitting");
    try {
      const res = await startCardCheckout({ planId: selected.id, email: cleanEmail, addNumber: withNumber });
      if (res && "url" in res && res.url) {
        funnel("checkout_redirect", props);
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
      if (code === "invalid_email") {
        setEmailError(res && "error" in res && res.error ? String(res.error) : EMAIL_ERROR);
        emailRef.current?.focus();
        setStatus("idle");
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

  const ctaLabel = `Comprar ahora — ${formatMxn(total)}`;

  return (
    <div className="flex flex-col gap-3 sm:gap-4" data-testid="plan-picker">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 id="planes-titulo" className="text-lg font-bold text-fg sm:text-2xl">
          Elige tus datos
        </h2>
        <p className="text-[12px] text-muted sm:text-[13px]">Precios en pesos, IVA incluido</p>
      </div>

      {cancelled ? (
        <p className="rounded-xl bg-primary/[0.06] px-3.5 py-2.5 text-sm text-fg" role="status">
          No se hizo ningún cargo. Tu plan sigue elegido.
        </p>
      ) : null}

      <div ref={zoneRef} className="flex flex-col gap-3 sm:gap-4">
        <div role="radiogroup" aria-labelledby="planes-titulo" className="flex flex-col gap-1.5 sm:gap-2">
          {plans.map((p) => {
            const active = p.id === selected.id;
            const isRec = p.id === recommended?.id;
            const isTrial = p.id === trial?.id && !isRec;
            const badged = isRec || isTrial;
            return (
              <label
                key={p.id}
                data-testid={`plan-${p.id}`}
                data-selected={active || undefined}
                className={clsx(
                  "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-1 transition-[border-color,box-shadow,background-color] duration-200 ease-out-expo sm:min-h-14 sm:px-4",
                  "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring/25",
                  badged && "mt-2",
                  active
                    ? "border-primary bg-primary/[0.035] shadow-raised ring-1 ring-primary"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p.id}
                  checked={active}
                  onChange={() => choose(p)}
                  className="sr-only"
                  aria-label={`${p.dataGb} GB, ${formatDays(p.days)}, ${formatMxn(p.priceMxn)}${isRec ? ", recomendado" : ""}${isTrial ? ", para probar" : ""}`}
                />
                {badged ? (
                  <span
                    aria-hidden
                    data-testid={isRec ? "badge-recommended" : "badge-trial"}
                    className={clsx(
                      "absolute -top-2.5 left-10 inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10.5px] font-bold uppercase leading-none tracking-wide sm:left-11",
                      isRec ? "bg-marigold text-fg" : "border border-primary/25 bg-surface text-link",
                    )}
                  >
                    {isRec ? <Star className="size-3 fill-current" strokeWidth={0} /> : null}
                    {isRec ? "Recomendado" : "Para probar"}
                  </span>
                ) : null}
                <span
                  aria-hidden
                  className={clsx(
                    "grid size-5 shrink-0 place-items-center rounded-full border-2 bg-surface transition-colors",
                    active ? "border-primary" : "border-border-strong",
                  )}
                >
                  {active ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate tabular-nums">
                  <span className="font-display text-[17px] font-bold text-fg sm:text-lg">{p.dataGb} GB</span>
                  <span className="text-[15px] text-muted"> · {formatDays(p.days)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end tabular-nums">
                  <span className="leading-tight">
                    <span className="font-display text-[19px] font-bold text-fg sm:text-xl" data-testid={`price-${p.id}`}>
                      {formatPesos(p.priceMxn)}
                    </span>
                    <span className="ml-1 text-[11px] font-semibold tracking-wide text-muted">MXN</span>
                  </span>
                  <span className="text-[11px] leading-tight text-subtle" data-testid={`per-gb-${p.id}`}>
                    {formatPerGb(p.priceMxn, p.dataGb)}/GB
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5 text-[12.5px] leading-snug text-muted sm:text-[13px]">
          {trial ? (
            <p data-testid="trial-note">
              ¿Primera vez?{" "}
              <button
                type="button"
                onClick={() => choose(trial)}
                className="font-semibold text-link underline decoration-link/30 underline-offset-2 hover:decoration-link"
              >
                Prueba con {trial.dataGb} GB por {formatPesos(trial.priceMxn)}
              </button>{" "}
              y recarga después desde tu panel.
            </p>
          ) : null}
          <p>Solo datos: navega, usa WhatsApp y redes. No incluye número ni llamadas.</p>
        </div>

        <div ref={buyRef} id="comprar" className="flex scroll-mt-24 flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-email`} className="text-[14px] font-semibold text-fg">
              Correo para tu cuenta y tu QR
            </label>
            <div className="relative">
              <Mail aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-subtle" />
              <input
                ref={emailRef}
                id={`${uid}-email`}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="tu@correo.com"
                value={email}
                onFocus={onEmailFocus}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? `${uid}-email-error` : undefined}
                data-testid="email-input"
                className={clsx(
                  "h-12 w-full rounded-control border bg-surface pl-11 pr-3.5 text-base text-fg placeholder:text-subtle transition-colors focus:outline-none focus-visible:outline-none focus:ring-4",
                  emailError ? "border-danger focus:ring-danger/15" : "border-border-strong focus:border-primary focus:ring-ring/20",
                )}
              />
            </div>
            {emailError ? (
              <p id={`${uid}-email-error`} role="alert" className="text-[13px] font-medium text-danger" data-testid="email-error">
                {emailError}
              </p>
            ) : null}
          </div>

          {addon ? (
            <div className="relative flex items-center gap-2" data-testid="addon-row">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[14px] leading-snug text-fg">
                <input
                  type="checkbox"
                  checked={addNumber}
                  onChange={(e) => toggleAddon(e.target.checked)}
                  data-testid="addon-checkbox"
                  className="size-5 shrink-0 cursor-pointer accent-primary"
                />
                <span>
                  Añadir número para recibir códigos{" "}
                  <span className="whitespace-nowrap text-muted tabular-nums">(+{formatMxn(addon)} / 30 días)</span>
                </span>
              </label>
              <button
                type="button"
                aria-label="¿Qué es el número para recibir códigos?"
                aria-expanded={helpOpen}
                aria-controls={`${uid}-addon-help`}
                onClick={() => setHelpOpen((v) => !v)}
                onBlur={() => setHelpOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setHelpOpen(false);
                }}
                data-testid="addon-help"
                className="grid size-11 shrink-0 place-items-center rounded-full text-subtle hover:text-link"
              >
                <CircleHelp aria-hidden className="size-[18px]" />
              </button>
              <p
                id={`${uid}-addon-help`}
                role="tooltip"
                hidden={!helpOpen}
                className="absolute right-0 top-full z-10 -mt-1 w-64 max-w-[calc(100vw-3rem)] rounded-xl bg-fg px-3 py-2.5 text-[13px] leading-snug text-white shadow-raised"
              >
                Es un número móvil internacional para recibir códigos de verificación por SMS y llamadas. Los códigos
                te llegan a tu panel de NovaPhone.
              </p>
            </div>
          ) : null}

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
          {status === "submitting" ? (
            <p className="text-center text-[13px] text-muted" aria-live="polite">
              Abriendo el pago seguro…
            </p>
          ) : null}

          <Link
            href="/reembolsos"
            className="block text-balance text-center text-[13px] font-semibold leading-snug text-success hover:underline"
            data-testid="guarantee"
          >
            <BadgeCheck aria-hidden className="mr-1 inline size-4 -translate-y-px align-middle" />
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
      </div>

      {/* Sticky mobile buy bar */}
      {mounted
        ? createPortal(
          <div
            aria-hidden={pickerOnScreen}
            inert={pickerOnScreen}
            className={clsx(
              "pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 pt-2.5 shadow-[0_-10px_30px_-14px_rgb(11_27_51/0.3)] backdrop-blur-md transition-transform duration-300 ease-out-expo lg:hidden",
              pickerOnScreen ? "translate-y-full" : "translate-y-0",
            )}
            data-testid="sticky-bar"
            data-sticky-bar={pickerOnScreen ? "off" : "on"}
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

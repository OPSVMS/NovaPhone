# NovaPhone Design System

**Light-first, trustworthy, Mexican-friendly** ("Azul Nova", since 2026-10-15). Think a well-run Mexican telco or fintech: clean paper, deep blue for trust, one warm marigold accent, big legible type on phones. The references are Mercado Pago, Nu México, Revolut and Apple's setup screens. Trust is the first purchase driver, so every screen answers quickly: *¿qué es? ¿cuánto cuesta? ¿cómo lo activo? ¿en qué celulares? ¿y si no funciona?* UI copy is Spanish (es-MX, *tú*).

> The previous dark "quiet web3" look is retired. Token **names** are unchanged so app/admin pages keep working; only the values were remapped (see "Legacy names").

## Copy rules

- One idea per sentence. No jargon. Explain "eSIM" once per page: *"una SIM digital que se instala con un QR, sin chip físico"*.
- Hero formula: promise + proof + action ("Internet para tu celular en 2 minutos." → "eSIM de datos para México. Sin contrato ni trámites. 20 GB por $599 MXN." → picker).
- Prices always read as pesos: "$599 MXN" (`formatMxn`) or "$599" next to a visible "MXN". Never "US$".
- Payment row under every buy button: "Pago seguro con Stripe · Visa, Mastercard, Amex, Apple Pay, Google Pay · o SPEI". No crypto/USDT anywhere public.
- **Compliance:** never write "sin registro", "sin papeleo", "no pedimos CURP/INE" or "evita el registro" anywhere. The only allowed wording is the exact FAQ answer from `docs/ads/POLICY.md` §6.2 (legal status only, no promise, no adjectives): *"La vinculación de líneas con CURP que coordina la CRT aplica a las líneas móviles con número telefónico. La eSIM de NovaPhone es solo de datos: no te da un número mexicano, llamadas ni SMS, así que no sustituye tu línea. Si tienes una línea móvil, vincularla con tu compañía en las fechas oficiales sigue siendo tu responsabilidad; NovaPhone no cambia esa obligación. Información oficial: gob.mx/crt."*
- Say what is *not* included near the price: "Solo datos: … No incluye número ni llamadas."

## Brand

- **Mark ("Nodo")**: an N drawn as two identical, point-symmetric strokes (device and network) that meet at a point of light (the *nova*). 64-unit grid, 9u monoline, round caps and joins, 45° diagonal, 4.5u node. Geometry unchanged.
- **Colours (2026-10)**: strokes are an Azul Nova gradient (`#0A2F6B → #0A4FA3 → #3B8CE6`) and the node is **marigold** `#FFA31A` (cempasúchil). On dark/blue fills use the on-dark files (strokes `#3B8CE6 → #DCEBFF`).
- **Wordmark**: "NovaPhone" in Sora SemiBold, −25 tracking, outlined to paths (`currentColor`, so it inherits `text-fg` = navy ink).
- Files in `/brand`: `novaphone-logo-light.svg` (**primary**, light backgrounds), `novaphone-logo.svg` (on dark), `novaphone-mark.svg` (light backgrounds), `novaphone-mark-on-dark.svg`, `novaphone-app-icon.svg` (white mark on an Azul Nova tile, marigold node), PNG exports (`novaphone-mark-512.png`, `novaphone-mark-64.png`, `novaphone-logo.png`).
- App icons: `src/app/icon.svg` (blue tile), `src/app/apple-icon.png` (180×180), `src/app/opengraph-image.tsx` (light, with "20 GB por $599 MXN").
- Don't add effects to the mark, rebuild the N with a font, or put the colour mark on marigold. Clear space ≥ one stroke width.

```tsx
import { Logo, LogoMark } from "@/components/brand/logo";

<Logo size={24} />                      // lockup; size = height in px (default 28), width is automatic
<Logo size={24} title={null} />         // decorative (e.g. inside <Link aria-label="NovaPhone – inicio">)
<LogoMark size={32} />                  // glyph only (default 32)
<LogoMark variant="mono" className="text-muted" />  // single-colour, uses currentColor
```

## Tokens (Tailwind v4 `@theme`, `src/app/globals.css`)

Every token becomes a utility: `bg-surface`, `text-muted`, `border-border`, `rounded-card`, `shadow-raised`, `ease-out-expo`, and so on. Alpha works on any colour (`bg-primary/10`, `border-danger/25`).

| Token | Value | Use |
|---|---|---|
| `bg` | `#F5F7FB` | page background (cool paper; already on `<body>`) |
| `surface` | `#FFFFFF` | cards, panels, header when scrolled, footer |
| `surface-2` | `#EEF2F8` | inputs, nested areas, hover |
| `surface-3` | `#E2E9F3` | pressed / selected |
| `night` / `night-2` | `#0A2547` / `#0E3263` | optional deep-navy bands; text on them: `on-night` / `on-night-muted` |
| `border` / `border-strong` | `#DFE6EF` / `#C3CFDF` | hairlines / emphasis |
| `fg` | `#0B1B33` | primary text (16.9:1) |
| `muted` | `#44536A` | secondary text (8.1:1) |
| `subtle` | `#5B687C` | captions, placeholders (5.6:1; never body copy) |
| `primary` / `primary-hover` | `#0A4FA3` / `#083F85` | **Azul Nova**: CTA fills, selected plan ring, step icons |
| `primary-foreground` | `#FFFFFF` | text on primary (8.2:1) |
| `link` / `link-hover` | `#0A55B0` / `#083F85` | links, brand-coloured text and icons |
| `ring` | `#1F6FD1` | focus ring |
| `marigold` / `marigold-soft` / `marigold-ink` | `#FFA31A` / `#FFF1DA` / `#9A4A00` | warm accent: "Recomendado" badge, step numbers, the nova node. Fill only; marigold-family text uses `marigold-ink` |
| `accent` | `#0B7F72` | teal: live dots, small highlights (text-safe 4.9:1) |
| `whatsapp` | `#128C4B` | WhatsApp glyph/button only |
| `success` `warning` `danger` `info` | `#0F7A45` `#9A5600` `#C42B2B` `#1D5FC4` | status text; `/10` fills, `/25` borders |

**Legacy names kept for compatibility** (app/admin): `lavender` → `#0A55B0` (= link), `lavender-soft` → `#1859A8`, `accent` → teal, `shadow-glow*` → soft blue/marigold halos, `glass*` → frosted white. Prefer `link`, `marigold`, `shadow-raised` in new code. Hard-coded `bg-white/[0.0x]` hovers in old app files are now invisible (harmless); replace them with `bg-hover` when touching those files.

**Note:** the text-colour token is `fg` (`text-fg`), not `text`.

- **Fonts**: `font-display` (Sora) for headings, prices and big numbers; `font-sans` (Geist, the default); `font-mono` (Geist Mono) for CLABE, ICCID, references and codes. `h1`–`h4` get `font-display`, `-0.02em` tracking and balanced wrapping automatically.
- **Radii**: `rounded-control` (12px: buttons, inputs), `rounded-card` (20px), `rounded-panel` (28px: hero panels, dialogs), `rounded-full` (badges, pills).
- **Shadows**: `shadow-card` (default on cards), `shadow-raised` (picker, selected plan, sheets). `shadow-glow*` are legacy soft halos; avoid in new code.
- **Easing**: `ease-out-expo` for every UI transition; durations are 200ms for hover/press and 300–700ms for reveals.

### Utility classes

| Class | What it does |
|---|---|
| `glass` / `glass-strong` | frosted white surface, blur, hairline border (`glass-strong` for sticky bars) |
| `bg-hover` | navy 4% wash for hovers on light surfaces (replaces `bg-white/[0.04]`) |
| `glow`, `glow-sm`, `glow-accent` | soft halo box-shadows |
| `text-gradient` | navy → Azul Nova (headline) |
| `text-gradient-brand` | Azul Nova → teal (1–3 words max) |
| `border-gradient` | gradient hairline border on a `surface` fill (same as `<Card variant="gradient">`) |
| `noise` | film grain via `::after`; the element must be positioned |
| `bg-grid` | 48px faint grid; pair with `mask-fade-radial` or `mask-fade-b` |
| `hairline` | 1px divider with fading ends (`<div className="hairline" />`) |
| `shimmer` | loading sheen (used by `Skeleton`) |
| `pb-safe` | bottom padding that respects the iOS home indicator |
| `animate-fade-up` | one-shot CSS entrance (no JS) |
| `tabular-nums` | **always** on prices, balances, GB and countdowns |

Global behaviour already in place: focus-visible `ring` outline (2px, offset 2), light-blue text selection, thin scrollbars, smooth scroll (only without reduced motion), `color-scheme: light`, and `lang="es-MX"`.

## Layout and spacing

- The body is a plain block, not flex. Each route group's layout owns its own shell (navbar, sidebar, footer).
- Gutters come from `<Container>`: `px-4` → `sm:px-6` → `lg:px-8`.
- Spacing uses the 4px Tailwind scale. Use `gap-2`/`gap-3` inside controls, `gap-4`/`gap-6` between cards, `gap-8`/`gap-12` between blocks, and `py-16 sm:py-24` between landing sections (via `<Section>`). Card padding is `p-5 sm:p-6`.
- Mobile-first: design at **360px** first. Primary CTAs should be `fullWidth` on mobile, e.g. `className="w-full sm:w-auto"`. Tap targets are ≥ 44px (`Button` md is 44px).
- Type scale (large on phones): hero `text-[2.35rem] sm:text-5xl lg:text-6xl` bold, section title `text-3xl sm:text-4xl` bold, card title `text-lg`, body `text-[17px]` on marketing / `text-[15px]` in app, caption `text-[13px]`.

## Components

All components are in `src/components/ui/`, import with `@/components/ui/<file>`, and use named exports. Unless noted they are server components.

### Button (`button.tsx`)

```tsx
import { Button, buttonVariants } from "@/components/ui/button";

<Button>Comprar</Button>                                   // variant="primary" size="md", type="button"
<Button href="/planes" size="lg">Ver planes <ArrowRight /></Button>   // renders next/link
<Button variant="secondary" | "outline" | "ghost" | "inverse" | "danger" />
<Button size="sm" | "md" | "lg" | "icon" | "icon-sm" aria-label="…" />  // icon sizes need aria-label
<Button loading>Guardar</Button>                           // spinner, keeps width, disabled, aria-busy
<Button fullWidth type="submit" />
<a className={buttonVariants({ variant: "outline", size: "sm" })} />   // style any element
```

- Lucide icons inside a button are sized automatically, so do not set `size` on them.
- Use one `primary` per view region. `inverse` is a white button with blue text, for use on `night`/primary fills.

### SubmitButton (`submit-button.tsx`, client)

```tsx
<form action={loginAction}>
  …
  <SubmitButton fullWidth pendingText="Entrando…">Entrar</SubmitButton>
</form>
```

It must be rendered inside the `<form>` because it uses `useFormStatus`. It accepts all native Button props except `href` and `type`.

### Card (`card.tsx`)

```tsx
<Card variant="default" | "glass" | "outline" | "gradient" interactive?>
  <CardHeader><CardTitle>Plan 10 GB</CardTitle><CardDescription>30 días</CardDescription></CardHeader>
  <CardContent>…</CardContent>
  <CardFooter><Button fullWidth>Comprar</Button></CardFooter>
</Card>
```

- Use `gradient` for a featured or recommended plan, with at most one per grid.
- Use `glass` over aurora or imagery.
- Use `interactive` for clickable cards (it adds a hover lift).

### Forms (`input.tsx`, `label.tsx`, `field.tsx`)

```tsx
import { Field } from "@/components/ui/field";
import { Input, Textarea, Select, controlClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

<Field label="Correo" name="email" type="email" autoComplete="email" required
       error={state?.errors?.email} hint="Te enviaremos un enlace" leading={<Mail />} />
<Input name="amount" inputMode="decimal" leading="$" trailing="MXN" />
<Select name="method"><option value="spei">SPEI</option></Select>
<Label htmlFor="x" optional>Referencia</Label>
```

- `Field` wires up the id, `aria-describedby` and `aria-invalid` for you; the error is announced.
- Invalid styling comes from `aria-invalid`.
- Set `inputMode` and `autoComplete` correctly on every input, because mobile keyboards depend on them.

### Badge (`badge.tsx`)

```tsx
<Badge variant="neutral" | "primary" | "accent" | "success" | "warning" | "danger" dot? | dot="pulse">Activa</Badge>
```

Use the following status mapping across the dashboard:

| Status | Variant |
|---|---|
| activa / completada | `success` |
| pendiente / procesando | `warning` (`dot="pulse"` while it is live) |
| fallida / reembolsada | `danger` / `neutral` |
| nuevo | `accent` |

### Alert (`alert.tsx`)

```tsx
<Alert variant="info" | "success" | "warning" | "error" title="Depósito acreditado" action={<Button size="sm" variant="ghost">Ver</Button>}>
  Tu saldo ya está disponible.
</Alert>
```

- `error` uses `role="alert"`; the others use `role="status"`.
- `icon={null}` hides the icon.

### Stat (`stat.tsx`)

```tsx
<Stat label="Saldo" icon={<Wallet />} value="$1,249.00" hint="MXN disponible"
      aside={<Badge variant="success" dot>Activo</Badge>} size="md" | "lg" />
```

### Feedback and empty states

```tsx
import { Skeleton } from "@/components/ui/skeleton";          <Skeleton className="h-24 rounded-card" />
import { Spinner } from "@/components/ui/spinner";            <Spinner size={16} label="Cargando planes" />
import { EmptyState } from "@/components/ui/empty-state";
<EmptyState icon={<Smartphone />} title="Aún no tienes eSIMs" description="…" action={<Button href="/planes" size="sm">Ver planes</Button>} />
```

Use `loading.tsx` files built from `Skeleton` that mirror the real layout.

### CopyButton (`copy-button.tsx`, client)

```tsx
<CopyButton value={clabe} ariaLabel="Copiar CLABE" />                   // icon-only, secondary
<CopyButton value={code} label="Copiar código" variant="outline" />     // with label
```

- Props: `value`, `label?`, `copiedLabel="Copiado"`, `ariaLabel="Copiar"`, `variant`, `size`, `onCopied?`.
- Use it for CLABE, the SPEI reference, the USDT address and amount, the ICCID and the LPA activation code.

### Segmented (`segmented.tsx`, client)

```tsx
<Segmented aria-label="Método de pago" name="method" defaultValue="spei" fullWidth
  options={[{ value: "spei", label: "SPEI" }, { value: "usdt", label: "USDT" }]}
  onValueChange={(v) => …} />
```

- It is a radiogroup with arrow-key navigation and a sliding indicator.
- It can be controlled (`value`) or uncontrolled (`defaultValue`).
- With `name` set, it submits through a hidden input.
- Use it for tabs, filters and small toggles.

### Dialog (`dialog.tsx`, client)

```tsx
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen} title="Confirmar compra" description="Se descontará de tu saldo."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button>Confirmar</Button></>}>
  …
</Dialog>
```

- It is built on native `<dialog>`, which provides the focus trap and Esc to close.
- On mobile it is a bottom sheet; from `sm` up it is a centred card.
- `size` is `"sm" | "md" | "lg"`.

### Layout (`container.tsx`, `section.tsx`)

```tsx
import { Container } from "@/components/ui/container";   // size="sm"|"md"|"lg"(default)|"xl" → 672/896/1152/1280px
import { Section, SectionHeader } from "@/components/ui/section";

<Section id="como-funciona" spacing="md" container="lg">   // container={false} → no inner Container
  <SectionHeader eyebrow="Cómo funciona" title="Tres pasos. Cero tiendas." description="…" align="center" as="h2" />
</Section>
```

## Motion (`src/components/motion/`)

```tsx
import { Aurora } from "@/components/motion/aurora";       // server component, pure CSS
import { FadeIn } from "@/components/motion/fade-in";      // client
import { Stagger, StaggerItem } from "@/components/motion/stagger";  // client

<section className="relative isolate overflow-hidden">
  <Aurora variant="hero" | "subtle" | "spot" grid? noise? />   // absolute, -z-10, aria-hidden
  <FadeIn immediate>…hero copy…</FadeIn>                      // above the fold: animate on mount
</section>

<FadeIn delay={0.1} y={16} as="div" | "section" | "li" | "article" | "span" | "header">…</FadeIn>   // on scroll, once

<Stagger className="grid gap-4 sm:grid-cols-3" gap={0.07} as="div" | "ul">
  <StaggerItem>…</StaggerItem>   // as="li" inside a ul
</Stagger>
```

- **Aurora** variants: `hero` is for the landing hero (grid on by default), `subtle` is for app and auth pages, and `spot` is a single glow behind a card or CTA. Use it once per page.
- **Reduced motion**: `<MotionProvider>` (already in the root layout) sets `reducedMotion="user"`. Under reduced motion, transforms are skipped and only opacity fades remain. The aurora freezes via `motion-reduce:animate-none`. Add `motion-reduce:*` to any CSS animation you write.
- Reveal content once and never re-animate it on scroll-back. Use no parallax on text, no infinite motion except the aurora and live dots, and no bouncy springs (indicator springs use bounce ≤ 0.15).
- Timing: hover/press 200ms, reveals 600–700ms with `ease-out-expo` (`[0.16, 1, 0.3, 1]`), stagger 60–80ms, and never more than 6 staggered items.
- Do **not** wrap whole pages in client components to animate them. Keep pages as server components and wrap only the leaves in `FadeIn` or `Stagger`.

## Landing (home = sales page)

Mobile-first, under 5 screens, in this order: **Hero + plan picker** (`hero.tsx`, `plan-picker.tsx`) → **Cómo funciona** (3 steps) → **Lo que incluye tu cuenta** (`account-benefits.tsx`: 6 compact true claims, 2 columns on phones, + "Elegir mi plan" back to `#elegir-plan`) → **FAQs** + WhatsApp → footer (MASMOVIL S.A. de C.V., Guadalajara).

- **Number copy:** never say "+44" or "Reino Unido" in marketing. It is the "número para recibir códigos de verificación (SMS y llamadas)"; only the "?" tooltip may call it "un número móvil internacional". Never claim "varios números" (one per account) or "100 eSIMs".

- Picker: **every** marketed plan visible at once (`MARKETED_PLAN_IDS` in `plans-data.ts`: 1 GB/7 d, 3 GB/15 d, 3 GB/30 d, 5, 10, 20 GB/30 d; 50 GB is not marketed), cheapest first, as compact one-line rows ("1 GB · 7 días" left, "$39 MXN" + tiny "$39/GB" right) so all six fit in about one phone screen. **20 GB "Recomendado"** is last and preselected; 1 GB/7 d carries a "Para probar" badge, and the note under the list reads "¿Primera vez? Prueba con 1 GB por $39 y recarga después desde tu panel." (tapping it selects 1 GB). Mexican buyers want to try cheap first (director decision 2026-10-16).
- Under the list: required email field "Correo para tu cuenta y tu QR" (validated client-side; the server's `invalid_email` shows on the field), then the add-on line, a checkbox "Añadir número para recibir códigos (+$79 MXN / 30 días)" with a "?" tooltip, which adds $79 to the button total.
- Buy button "Comprar ahora — $599 MXN" (or "$678 MXN" with the number) → server action `startCardCheckout({ planId, email, addNumber })` → Stripe. Guarantee line and payment row right under the button; secondary link "Pagar con SPEI / ya tengo cuenta" → `/app/comprar?plan=…`.
- Mobile sticky bar (WhatsApp + "Comprar ahora — $X MXN") hides while any part of the plan list or the in-page buy button is on screen, so it never covers a plan.
- Mobile budget (390×844): hero + picker + buy button within one scroll (the six plans fit on the first screen; email, add-on and button follow right after). Keep the hero copy compact.
- Funnel events: `plan_select`, `email_focus` (first focus), `addon_toggle`, `buy_click`, `checkout_redirect`, `buy_error` (incl. client `email_missing` / `email_invalid`) (+ GA4 `view_item_list`, `select_item`, `begin_checkout`) via `src/components/marketing/funnel.ts`.
- `/planes` renders the same picker with every plan visible. `/reembolsos` holds the 30-day refund + connection guarantee.
- JSON-LD: Organization + Product/AggregateOffer (`json-ld.tsx`) and FAQPage (`faq-section.tsx`).

## Do / Don't

**Do**
- Keep surfaces white on cool paper with 1px hairlines, so blue and marigold mean something.
- Use `primary` for the single main action per region, `link` for interactive text, `marigold` only for the recommended badge / step numbers / the nova node.
- Use `tabular-nums` and `font-display` for every money and data amount. Format with `formatMxn` / `formatPesos` (`src/components/marketing/format.ts`).
- Put the guarantee and the payment methods right under the buy button.
- Use `font-mono` and a `CopyButton` for anything the user copies.
- Use sentence case and short Spanish copy ("Ver planes", not "VER PLANES").
- Test at 360–390px and run keyboard-only checks.

**Don't**
- Use purple, neon, glows or dark heroes on the public site.
- Sell "sin registro" as a benefit, mention crypto/USDT, or show prices that could read as dollars.
- Use `subtle` for body text, marigold as a text colour (use `marigold-ink`), or pure `#000` backgrounds.
- Use raw hex values in components; add a token instead.
- Use emoji as icons; use `lucide-react` at 16–24px.
- Override `<body>` font or colour, or add global CSS outside `globals.css`.

## Notes for agents

- No navbar lives in the root layout. Marketing and app route groups bring their own.
- `metadataBase` comes from `APP_URL`, and the title template is `"%s · NovaPhone"`. Pages export `metadata = { title: "Planes" }`.
- An OG image is defined at the root and inherited, so add per-route `opengraph-image.tsx` only if needed. The Sora TTFs for `next/og` are in `src/assets/fonts/`.
- There is no `tailwind-merge`. Component `className` props are appended with `clsx`, so pass additive classes and don't try to override a component's own colour or size utilities. Use the `variant` and `size` props instead.

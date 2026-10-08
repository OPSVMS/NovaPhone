# NovaPhone Design System

Dark-only, minimal, "quiet web3". The references are Linear, Vercel, Phantom and Arc. Prefer restraint to decoration. UI copy is Spanish (es-MX).

## Brand

- **Mark ("Nodo")**: an N drawn as two identical, point-symmetric strokes (device and network) that meet at a cyan point of light (the *nova*). It sits on a 64-unit grid, uses a 9u monoline with round caps and joins, a 45° diagonal and a 4.5u node.
- **Wordmark**: "NovaPhone" set in Sora SemiBold with −25 tracking. It is outlined to paths, so it never depends on font loading.
- Files in `/brand`: `novaphone-mark.svg` (glyph, transparent, for dark backgrounds), `novaphone-app-icon.svg` (glyph on a dark tile), `novaphone-logo.svg` (dark backgrounds), `novaphone-logo-light.svg` (light backgrounds), `novaphone-mark-512.png` and `novaphone-mark-64.png` (the **tile** version: opaque, QR- and avatar-safe), and `novaphone-logo.png`.
- App icons: `src/app/icon.svg` (tile favicon), `src/app/apple-icon.png` (180×180, full-bleed), and `src/app/opengraph-image.tsx`.
- Do **not** recolour the mark, add effects to it, place it on purple fills, or rebuild the N with a font. Its clear space is ≥ the width of one stroke on every side.

```tsx
import { Logo, LogoMark } from "@/components/brand/logo";

<Logo size={24} />                      // lockup; size = height in px (default 28), width is automatic
<Logo size={24} title={null} />         // decorative (e.g. inside <Link aria-label="NovaPhone – inicio">)
<LogoMark size={32} />                  // glyph only (default 32)
<LogoMark variant="mono" className="text-muted" />  // single-colour, uses currentColor
```

The wordmark uses `currentColor`, so it inherits `text-fg` from `<body>`. Both components are server-safe (no `"use client"`).

## Tokens (Tailwind v4 `@theme`, `src/app/globals.css`)

Every token becomes a utility: `bg-surface`, `text-muted`, `border-border`, `rounded-card`, `shadow-glow`, `ease-out-expo`, and so on. Alpha works on any colour, for example `bg-primary/10` or `border-danger/25`.

| Token | Value | Use |
|---|---|---|
| `bg` | `#07050D` | page background (already on `<body>`) |
| `surface` | `#0E0A18` | cards, panels |
| `surface-2` | `#151024` | inputs, nested and raised areas, hover |
| `surface-3` | `#1D1731` | pressed / selected |
| `border` | white 8% | default 1px hairlines |
| `border-strong` | white 14% | hover, emphasis, dashed empty states |
| `fg` | `#F5F3FF` | primary text |
| `muted` | `#A39DB8` | secondary text (7.8:1) |
| `subtle` | `#7A7393` | tertiary, placeholders, captions (4.5:1; never for body copy) |
| `primary` / `primary-hover` | `#7652F0` / `#8466F4` | CTA fills only (white text 5:1) |
| `primary-foreground` | `#FFFFFF` | text on primary |
| `lavender` / `lavender-soft` | `#A78BFA` / `#C4B5FD` | brand-coloured text, links, icons, focus ring |
| `accent` | `#7DE3F4` | cyan "nova"; ≤ 1 use per view (live dot, highlight word) |
| `success` `warning` `danger` `info` | `#34D399` `#FBBF24` `#F87171` `#93C5FD` | status text; use `/10` fills and `/25` borders |

**Note:** the text-colour token is `fg` (`text-fg`), not `text`.

- **Fonts**: `font-display` (Sora) for headings, prices and big numbers; `font-sans` (Geist, the default); `font-mono` (Geist Mono) for CLABE, ICCID, references and codes. `h1`–`h4` get `font-display`, `-0.02em` tracking and balanced wrapping automatically.
- **Radii**: `rounded-control` (12px: buttons, inputs), `rounded-card` (20px), `rounded-panel` (28px: hero panels, dialogs), `rounded-full` (badges, pills).
- **Shadows**: `shadow-card` (default on cards), `shadow-glow-sm`, `shadow-glow` and `shadow-glow-accent`. Use at most one glowing element per viewport.
- **Easing**: `ease-out-expo` for every UI transition; durations are 200ms for hover/press and 300–700ms for reveals.

### Utility classes

| Class | What it does |
|---|---|
| `glass` / `glass-strong` | translucent surface, blur, hairline border and top highlight (`glass-strong` is for sticky headers and bottom bars) |
| `glow`, `glow-sm`, `glow-accent` | soft halo box-shadows |
| `text-gradient` | white → lavender (headline) |
| `text-gradient-brand` | lavender → cyan (1–3 words max) |
| `border-gradient` | gradient hairline border on a `surface` fill (same as `<Card variant="gradient">`) |
| `noise` | film grain via `::after`; the element must be positioned |
| `bg-grid` | 48px faint grid; pair with `mask-fade-radial` or `mask-fade-b` |
| `hairline` | 1px divider with fading ends (`<div className="hairline" />`) |
| `shimmer` | loading sheen (used by `Skeleton`) |
| `pb-safe` | bottom padding that respects the iOS home indicator |
| `animate-fade-up` | one-shot CSS entrance (no JS) |
| `tabular-nums` | **always** on prices, balances, GB and countdowns |

Global behaviour already in place: focus-visible lavender ring (2px, offset 2), violet text selection, thin dark scrollbars, smooth scroll (only without reduced motion), `color-scheme: dark`, and `lang="es-MX"`.

## Layout and spacing

- The body is a plain block, not flex. Each route group's layout owns its own shell (navbar, sidebar, footer).
- Gutters come from `<Container>`: `px-4` → `sm:px-6` → `lg:px-8`.
- Spacing uses the 4px Tailwind scale. Use `gap-2`/`gap-3` inside controls, `gap-4`/`gap-6` between cards, `gap-8`/`gap-12` between blocks, and `py-16 sm:py-24` between landing sections (via `<Section>`). Card padding is `p-5 sm:p-6`.
- Mobile-first: design at **360px** first. Primary CTAs should be `fullWidth` on mobile, e.g. `className="w-full sm:w-auto"`. Tap targets are ≥ 44px (`Button` md is 44px).
- Type scale: hero `text-4xl sm:text-6xl`, section title `text-3xl sm:text-4xl`, card title `text-lg`, body `text-[15px]`/`text-base`, caption `text-[13px]`.

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
- Use one `primary` per view region. Use `inverse` (white) as the single hero CTA when a violet button would compete with the aurora.

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

## Do / Don't

**Do**
- Keep surfaces almost black with 1px hairlines, so that colour means something.
- Use `lavender` for interactive and brand text and `accent` (cyan) only as the nova spark.
- Use `tabular-nums` and `font-display` for every money and data amount. Format with `Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })`.
- Use `font-mono` and a `CopyButton` for anything the user copies.
- Use sentence case and short Spanish copy ("Ver planes", not "VER PLANES").
- Test at 360px and run keyboard-only checks.

**Don't**
- Use neon saturated purples, purple-on-purple text, rainbow gradients, or `text-gradient-brand` on full sentences.
- Glow more than one element per screen or stack glass on glass.
- Use `subtle` for body text, `primary` as a text colour on dark (use `lavender`), or pure `#000`/`#fff` backgrounds.
- Use raw hex values in components; add a token instead.
- Use emoji as icons; use `lucide-react` at 16–20px.
- Override `<body>` font or colour, or add global CSS outside `globals.css`.

## Notes for agents

- `src/app/page.tsx` is a temporary placeholder (centred `<Logo />`); replace it.
- No navbar lives in the root layout. Marketing and app route groups bring their own.
- `metadataBase` comes from `APP_URL`, and the title template is `"%s · NovaPhone"`. Pages export `metadata = { title: "Planes" }`.
- An OG image is defined at the root and inherited, so add per-route `opengraph-image.tsx` only if needed. The Sora TTFs for `next/og` are in `src/assets/fonts/`.
- There is no `tailwind-merge`. Component `className` props are appended with `clsx`, so pass additive classes and don't try to override a component's own colour or size utilities. Use the `variant` and `size` props instead.

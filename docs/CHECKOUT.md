# Compra directa con tarjeta (contrato para las páginas de marketing)

Embudo para tráfico de Google Ads: **plan (+ número opcional) → correo → “Comprar” → Stripe Checkout (tarjeta, Apple Pay, Google Pay; MXN) → QR en pantalla + correo**.
No se pide cuenta ni contraseña antes de pagar, pero **sí el correo**: con él el backend busca o crea la cuenta (sin verificar, sin contraseña) y lo prellena en Stripe.
El monedero, SPEI y la compra con saldo en `/app` siguen igual.

## 1. Iniciar el pago: `startCardCheckout`

```ts
"use client";
import { startCardCheckout } from "@/app/actions/checkout";
import { logEvent, flushEvents } from "@/lib/analytics/funnel-client";

async function onBuy(planId: string, priceMxn: number, email: string, addNumber: boolean) {
  logEvent("buy_click", { plan: planId, price: priceMxn, number: addNumber });
  const r = await startCardCheckout({ planId, email, addNumber });
  if ("url" in r) {
    logEvent("checkout_redirect", { plan: planId });
    flushEvents(true); // manda el lote con sendBeacon antes de salir
    window.location.assign(r.url);
  } else {
    logEvent("buy_error", { plan: planId, code: r.code });
    // muestra r.error (texto en español listo para el usuario); con "invalid_email", junto al campo de correo
  }
}
```

- Entrada: `{ planId: string; email: string; addNumber?: boolean }`.
  - `planId` es `plans.id` (p. ej. `"MX_20_30"`, el mismo `id` que usa `getActivePlans()`).
  - `email` es **obligatorio** sin sesión. Se normaliza (sin espacios, en minúsculas, máx. 254) y se valida; si no es válido regresa `invalid_email`. Con ese correo se busca la cuenta o se crea una sin verificar y sin contraseña, y la orden pendiente queda ligada a ella. Stripe lo recibe como `customer_email` (prellenado, no editable) con `customer_creation: if_required`.
    Con sesión iniciada manda la cuenta de la sesión: `email` puede omitirse y, si viene distinto, se ignora.
  - `addNumber: true` agrega una segunda línea, **“Número para recibir códigos · 30 días”, MXN 79** (`NUMBER_PRICE_MXN`, `PHONE_NUMBER_PRICE_MXN`). Solo se agrega si hay números que vender (`canSellNumber()`: inventario libre o cloudnumbering con saldo) y la cuenta todavía no tiene número. Si no, se ignora sin error y **no se cobra**: el checkout queda solo con el plan. La página puede mostrar la opción siempre; el total real es el de Stripe.
- Salida: `{ url }` → redirige el navegador a Stripe, o `{ error, code }` con
  `code`: `"payments_disabled" | "unavailable" | "invalid_email" | "account_disabled" | "provider_error"`.
- Precio: `plan.priceMxn × 100` centavos MXN (+ 7 900 con número). Stripe muestra el campo de código promocional; el descuento se aplica a la eSIM, el número siempre vale MXN 79.
- Los precios son fijos y en MXN: 1 GB/7 días $39, 3 GB/15 días $109, 3 GB/30 días $119, 5 GB/30 días $189, 10 GB/30 días $329 y 20 GB/30 días $599 (`FIXED_PRICES_MXN` en `src/lib/catalog.ts`). La sincronización diaria los respeta y solo calcula costo × tipo de cambio para planes fuera de esa lista.
- Solo se venden planes activos. El de 50 GB está retirado (`RETIRED_MIN_GB` en `src/lib/catalog.ts`), así que la acción lo rechaza con `unavailable` aunque una página vieja lo muestre.
- También existe como JSON: `POST /api/checkout` con `{ planId, email, addNumber? }` → `200 { url }` | `400 { code: "invalid_email" }` | `404/403/503/502 { error, code }`
  (`unavailable` 404, `account_disabled` 403, `payments_disabled` 503, `provider_error` 502; sin `planId`, 400).

## 2. Rutas de regreso

| Caso | URL |
|---|---|
| Pago completado (`success_url`) | `/compra/{orderId}?t={token}` (página de éxito, sin sesión) |
| Cancelar en Stripe (`cancel_url`) | `/planes?plan={planId}&cancelled=1`. La página de planes preselecciona `plan` y, con `cancelled=1`, avisa que no se hizo ningún cargo. |
| Expirada / reintentar | La página de éxito enlaza a `/planes?plan={planId}` |

`/compra/[id]` es del backend: QR, instalación con un toque para iOS y Android, códigos manuales, pasos, “actívala cuando estés listo”, aviso de correo enviado, liga a la cuenta y, si se compró, el número (“Tu número para códigos: +44…; los mensajes llegan a tu panel”). Consulta `GET /api/orders/{id}?t={token}` cada 1.5–5 s hasta que la eSIM esté lista. La forma de la respuesta es `OrderForSuccess` en `src/lib/checkout.ts`; con número agrega:

- `number: { e164 } | null`: número asignado en esta compra.
- `numberRefund: { amountMxn: 79, to: "card" | "wallet" } | null`: se pidió número pero ya no había al pagar; se devolvió a la tarjeta (o, si Stripe falló, quedó como saldo).
- `purchase.items` trae dos líneas (`MX_…` y `NUMBER_30`).

Los compradores sin cuenta entran desde **“Crear mi contraseña”** (`/recuperar?email=…`): reciben un código de 6 dígitos por correo, crean su contraseña y quedan con el correo verificado. No hay que cambiar el login.

## 3. Analítica

`<Analytics />` ya está montado en `src/app/layout.tsx`. Carga gtag (GA4 + Google Ads), Microsoft Clarity, la captura de atribución (`gclid`, `gbraid`, `wbraid`, `fbclid`, `utm_*`, landing y referrer en la cookie `np_attr` por 90 días; esa atribución se guarda en la orden) y `page_view` en el embudo propio. No hay banner de consentimiento (México).

Variables públicas: `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` (`AW-…`), `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`, `NEXT_PUBLIC_CLARITY_ID`. Del servidor, opcional: `GA4_API_SECRET`, que envía `purchase` por Measurement Protocol si la página de éxito nunca carga. Sin una variable, su pieza no hace nada.

### `logEvent` (embudo propio, anónimo, sin correo)

```ts
import { logEvent } from "@/lib/analytics/funnel-client";
logEvent("plan_select", { plan: "MX_20_30", price: 599 });
```

Eventos aceptados del navegador: `page_view` (automático), `plan_select`, `buy_click`, `checkout_redirect`, `buy_error`, `cta_click`, más los espejos de GA4 (`view_item_list`, `view_item`, `select_item`, `begin_checkout`, `purchase`, `sign_up`).
Las props deben ser escalares: hasta 12, de 100 caracteres como máximo; se descarta cualquier valor que parezca correo.
El servidor agrega solo `checkout_started` y `paid`. El tablero está en **/admin/embudo**.

Eventos de GA4 + Google Ads tipados (también se reflejan en el embudo propio):

```ts
import { track } from "@/components/analytics";
track("view_item_list", { items: plans.map((p) => ({ item_id: p.id, item_name: p.name, price: p.priceMxn })) });
track("begin_checkout", { value: 599, items: [{ item_id: "MX_20_30", item_name: "México 20 GB · 30 días", price: 599 }] });
```

`currency` vale `"MXN"` por defecto.

### `<PurchaseTracker>`

Ya está en `/compra/[id]`, así que no hace falta montarlo. Para otra página de éxito:

```tsx
import { PurchaseTracker } from "@/components/analytics";
<PurchaseTracker order={{ id, valueMxn: 599, email, items: [{ id: "MX_20_30", name: "México 20 GB · 30 días", price: 599 }] }} />
```

Envía GA4 `purchase` y la conversión de compra de Google Ads (`AW-…/label`, valor, MXN, `transaction_id`) una sola vez por orden; lo controla con localStorage. También manda el correo para conversiones mejoradas.

## 4. Backend (referencia)

- Webhook: `POST /api/webhooks/stripe`. En Stripe hay que habilitar los eventos `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded` y `charge.dispute.created`. Requiere `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`.
- Tablas: `card_checkouts` (orden pendiente de pago; su `id` es el id de la orden) y `funnel_events`. Migración `drizzle/0008_card_checkout_funnel.sql`.
- Tablas: `card_checkouts.number_cents`, `number_status` (`pending → assigned | refunded | failed`) y `number_id`. Migración `drizzle/0009_card_checkout_number.sql` (aplicarla antes de desplegar).
- Contabilidad de cada compra con tarjeta (todo idempotente por sesión de Stripe; el webhook se puede repetir):
  - un depósito `card` completado por el **total** cobrado (`meta.kind = "esim"`, `meta.numberCents`, `external_id = stripe:{cs_…}`);
  - en el ledger, “Pago con tarjeta” (+total) y “eSIM …” (−eSIM); la orden en `orders` con `price_cents` = parte de la eSIM;
  - con número: se asigna por el camino normal de compra con saldo (`assignNumber`), así que el ledger muestra “Número NovaPhone +44…” (−79) y el saldo neto queda en 0. El número queda ligado a la eSIM (`phone_numbers.order_id`).
  - Si al pagar ya no hay número (inventario agotado y cloudnumbering no puede comprar, o la cuenta ya tenía uno): reembolso **parcial** de MXN 79 a la tarjeta, “Reembolso a tu tarjeta (número)” (−79) en el ledger, `refunded_cents` += 7 900 y bitácora `card_checkout.number_refund` en `admin_audit`. Si el reembolso en Stripe falla (o `AUTO_REFUND_ON_FAILURE=false`), los 79 se quedan como saldo del cliente (`number_status = failed`) y queda la bitácora para revisión.
- Si eSIM Access rechaza el pedido, se reembolsa a la tarjeta automáticamente **solo la parte de la eSIM**; si se asignó número, el cliente lo conserva.
- Las recargas de saldo con tarjeta en `/app/fondos` también usan Stripe. Al cliente se le suma la comisión: `CARD_FEE_PCT` (3.6 por defecto) + `CARD_FEE_FIXED_MXN` (3) + IVA; con `CARD_PASS_FEES=false` no se cobra. USDT ya no se ofrece.

# NovaPhone

eSIM de datos para México sobre red Telcel 5G. Next.js 16 + Neon Postgres + Vercel.

## Desarrollo

```bash
pnpm install
vercel env pull .env.local   # o copia .env.example
pnpm db:push                  # aplica el esquema a Neon
pnpm catalog:sync             # trae planes del proveedor y calcula precios MXN
pnpm dev
```

## Flujos

- **Registro / login** con verificación de correo (Resend). Si `RESEND_API_KEY` está vacío las cuentas se verifican solas.
- **Fondos**: el usuario genera una solicitud SPEI (referencia de 8 dígitos) o USDT (monto único). Se acredita vía
  `POST /api/webhooks/deposits` firmado con `x-novaphone-signature = hex(HMAC-SHA256(body, DEPOSITS_WEBHOOK_SECRET))`,
  o manualmente desde `/admin`.
- **Compra**: descuenta saldo, ordena en eSIM Access (`transactionId` = id de la orden), y se completa por webhook
  `POST /api/webhooks/esimaccess?token=ESIMACCESS_WEBHOOK_TOKEN` o por consulta desde la página de la orden. Si falla, se reembolsa.
- **Precios**: costo USD × tipo de cambio × `PRICE_MARKUP` (1.33), redondeado hacia arriba a un número que termina en 9.
  Cron diario `/api/cron/sync-catalog`.

## Pruebas E2E (Docker)

```bash
pnpm test:e2e
```

Levanta Postgres + proxy HTTP tipo Neon + simulador de eSIM Access (`e2e/mock`) + la app compilada + Playwright,
y corre 19 escenarios en escritorio y móvil: sitio público completo (scroll, menú, FAQ), registro/login/logout,
depósitos SPEI y USDT por webhook firmado, idempotencia, compra con eSIM lista y QR, saldo insuficiente,
reembolso automático cuando falla el proveedor, aprobación de depósitos desde admin y protección de la API.

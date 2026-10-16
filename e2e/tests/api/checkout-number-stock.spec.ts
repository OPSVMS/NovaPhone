import { test, expect } from "@playwright/test";
import { dbQuery, uniqueEmail } from "../helpers";

/**
 * Checkout con número (`addNumber`) cuando no hay números: cambia estado global (inventario y saldo de cloudnumbering
 * en el simulador), así que corre en su propio proyecto, en serie y después de todo lo demás (ver playwright.config.ts).
 */

const MOCK = () => process.env.MOCK_URL!;
const mock = (path: string, body: unknown) => fetch(`${MOCK()}${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());
const cnBalance = (balance: number) => mock("/__test/cn/state", { balance });

type Checkout = { id: string; status: string; user_id: string; access_token: string; payment_ref: string; payment_intent_id: string | null; number_cents: number; number_status: string | null; number_id: string | null; refunded_cents: number; amount_paid_cents: number | null };
type Session = { id: string; customer_email: string | null; amount_total: number; line_items: { price_data: { unit_amount: string } }[] };

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  // Sin inventario propio: lo disponible se retira (solo quedan números asignados).
  await dbQuery("update phone_numbers set status = 'retired' where status in ('available','cooldown')");
});
test.afterAll(async () => {
  await cnBalance(300);
});

async function start(request: import("@playwright/test").APIRequestContext, email: string) {
  const res = await request.post("/api/checkout", { data: { planId: "MX_20_30", email, addNumber: true } });
  expect(res.status(), await res.text()).toBe(200);
  const sessionId = ((await res.json()) as { url: string }).url.split("/").pop()!;
  const [checkout] = await dbQuery<Checkout>("select * from card_checkouts where payment_ref = $1", [sessionId]);
  const session = ((await fetch(`${MOCK()}/__test/stripe/sessions`).then((r) => r.json())) as Session[]).find((s) => s.id === sessionId)!;
  return { checkout, session };
}

test("addNumber sin inventario (y cloudnumbering sin saldo): se ignora, solo se cobran 599", async ({ request }) => {
  await cnBalance(0);
  const email = uniqueEmail("sin-numero");
  const { checkout, session } = await start(request, email);
  expect(checkout).toMatchObject({ number_cents: 0, number_status: null });
  expect(session.customer_email).toBe(email);
  expect(session.line_items.map((l) => Number(l.price_data.unit_amount))).toEqual([59900]);
  expect(session.amount_total).toBe(59900);

  const paid = await mock("/__test/stripe/pay", { referenceId: checkout.id });
  expect(paid.events[0].json.result).toBe("order-placed");
  const ledger = await dbQuery<{ kind: string; amount_cents: number; balance_after_cents: number }>("select * from ledger where user_id = $1 order by created_at", [checkout.user_id]);
  expect(ledger.map((l) => [l.kind, l.amount_cents, l.balance_after_cents])).toEqual([
    ["deposit", 59900, 59900],
    ["purchase", -59900, 0],
  ]);
  expect(await dbQuery("select id from phone_numbers where user_id = $1", [checkout.user_id])).toHaveLength(0);
  const view = await (await request.get(`/api/orders/${checkout.id}?t=${checkout.access_token}`)).json();
  expect(view).toMatchObject({ paidMxn: 599, number: null, numberRefund: null });
});

test("webhook: el número se agotó entre el checkout y el pago → reembolso parcial de 79 a la tarjeta + bitácora", async ({ request, page }) => {
  test.setTimeout(120_000);
  // Al iniciar sí se puede vender (cloudnumbering con saldo) → se cobra el número.
  await cnBalance(300);
  const email = uniqueEmail("numero-agotado");
  const { checkout, session } = await start(request, email);
  expect(checkout).toMatchObject({ number_cents: 7900, number_status: "pending" });
  expect(session.amount_total).toBe(67800);

  // Antes de pagar, cloudnumbering ya no puede comprar números y no hay inventario.
  await cnBalance(0);
  const paid = await mock("/__test/stripe/pay", { referenceId: checkout.id });
  expect(paid.events[0].json.result).toBe("order-placed");

  const row = (await dbQuery<Checkout>("select * from card_checkouts where id = $1", [checkout.id]))[0];
  expect(row).toMatchObject({ status: "fulfilled", amount_paid_cents: 67800, number_status: "refunded", number_id: null, refunded_cents: 7900 });
  // Reembolso parcial en Stripe (simulador) por exactamente 79.
  const refunds = (await fetch(`${MOCK()}/__test/stripe/refunds`).then((r) => r.json())) as { payment_intent: string; amount: number; metadata: { reason?: string } }[];
  const mine = refunds.filter((r) => r.payment_intent === row.payment_intent_id);
  expect(mine.map((r) => r.amount)).toEqual([7900]);
  expect(mine[0].metadata.reason).toBe(`number-unavailable:${checkout.id}`);

  // Ledger: total abonado, eSIM cargada, los 79 salen como reembolso a la tarjeta; saldo 0. La eSIM sigue su curso.
  const ledger = await dbQuery<{ kind: string; amount_cents: number; balance_after_cents: number; description: string }>("select * from ledger where user_id = $1 order by created_at", [row.user_id]);
  expect(ledger.map((l) => [l.kind, l.amount_cents, l.balance_after_cents])).toEqual([
    ["deposit", 67800, 67800],
    ["purchase", -59900, 7900],
    ["adjustment", -7900, 0],
  ]);
  expect(ledger[2].description).toBe("Reembolso a tu tarjeta (número)");
  expect((await dbQuery<{ price_cents: number }>("select price_cents from orders where id = $1", [checkout.id]))[0].price_cents).toBe(59900);
  expect(await dbQuery("select id from phone_numbers where user_id = $1", [row.user_id])).toHaveLength(0);
  const audit = await dbQuery<{ action: string; admin_id: string | null; details: { amountCents: number; refundedToCard: boolean; reason: string } }>(
    "select * from admin_audit where target_id = $1 and action = 'card_checkout.number_refund'",
    [checkout.id],
  );
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ admin_id: null, details: { amountCents: 7900, refundedToCard: true, reason: "none" } });

  // Reintento del webhook: no se reembolsa dos veces.
  const again = await mock("/__test/stripe/webhook", { type: "checkout.session.completed", object: paid.session });
  expect(again.json.result).toBe("duplicate");
  expect((await fetch(`${MOCK()}/__test/stripe/refunds`).then((r) => r.json())).filter((r: { payment_intent: string }) => r.payment_intent === row.payment_intent_id)).toHaveLength(1);

  // Página de éxito: sin número y aviso del reembolso.
  const view = await (await request.get(`/api/orders/${checkout.id}?t=${checkout.access_token}`)).json();
  expect(view).toMatchObject({ paidMxn: 678, number: null, numberRefund: { amountMxn: 79, to: "card" } });
  await page.goto(`/compra/${checkout.id}?t=${checkout.access_token}`);
  await expect(page.getByTestId("order-number-refund")).toContainText("Te devolvimos $79 a tu tarjeta");
});

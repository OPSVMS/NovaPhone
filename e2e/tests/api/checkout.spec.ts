import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { dbQuery, register, emailOf, uniqueEmail } from "../helpers";

/**
 * Compra directa con tarjeta (Stripe Checkout, MXN) sin cuenta: /api/checkout → Stripe (simulador) → webhook firmado
 * → usuario creado por correo → depósito "card" + cargo en el ledger → eSIM Access → correo con QR → /compra/[id].
 */

const MOCK = () => process.env.MOCK_URL!;
const mock = (path: string, body: unknown) => fetch(`${MOCK()}${path}`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.json());

type Checkout = {
  id: string;
  status: string;
  user_id: string | null;
  access_token: string;
  payment_ref: string;
  payment_intent_id: string | null;
  amount_paid_cents: number | null;
  attribution: Record<string, string> | null;
  order_id: string | null;
  deposit_id: string | null;
  flag_reason: string | null;
  promotion_code: string | null;
};
const checkoutById = async (id: string) => (await dbQuery<Checkout>("select * from card_checkouts where id = $1", [id]))[0];

/** Inicia el checkout como lo haría la página de planes (mismas cookies que el navegador). */
async function startCheckout(page: Page, planId = "MX_5_30") {
  const res = await page.request.post("/api/checkout", { data: { planId } });
  expect(res.status(), await res.text()).toBe(200);
  const { url } = (await res.json()) as { url: string };
  expect(url).toMatch(/\/stripe\/pay\/cs_test_/);
  const sessionId = url.split("/").pop()!;
  const [row] = await dbQuery<Checkout>("select * from card_checkouts where payment_ref = $1", [sessionId]);
  expect(row.status).toBe("pending");
  return { url, sessionId, checkout: row };
}

test.describe("Compra directa con tarjeta (Stripe)", () => {
  test("invitado: paga → webhook → cuenta creada → eSIM lista → correo → página de éxito → embudo", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const campaign = `e2e-${randomUUID().slice(0, 8)}`;
    const gclid = `gclid-${randomUUID().slice(0, 8)}`;
    const email = uniqueEmail("tarjeta");

    // Llega desde un anuncio: <Analytics /> guarda np_attr y registra page_view (np_vid).
    await page.goto(`/terminos?gclid=${gclid}&utm_source=google&utm_medium=cpc&utm_campaign=${campaign}&utm_term=esim+mexico`);
    await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "np_attr" && decodeURIComponent(c.value).includes(gclid))).toBe(true);
    const visitor = (await page.context().cookies()).find((c) => c.name === "np_vid")?.value;
    expect(visitor).toMatch(/^[a-f0-9]{32}$/);
    // Pasos del cliente (lo que mandaría la página de planes con logEvent).
    const ev = await page.request.post("/api/events", {
      data: [
        { event: "plan_select", path: "/planes", props: { plan: "MX_5_30", price: 189 } },
        { event: "buy_click", path: "/planes", props: { plan: "MX_5_30", email: "nunca@se.guarda" } },
        { event: "checkout_redirect", path: "/planes", props: { plan: "MX_5_30" } },
      ],
    });
    expect(ev.status()).toBe(204);
    // Eventos del servidor no se aceptan del cliente.
    expect((await page.request.post("/api/events", { data: [{ event: "paid", path: "/" }] })).status()).toBe(400);

    const { url, checkout } = await startCheckout(page);
    expect(checkout.user_id).toBeNull();
    expect(checkout.attribution?.gclid).toBe(gclid);
    expect(checkout.attribution?.utm_campaign).toBe(campaign);

    // Stripe Checkout: sin correo previo, MXN, código promocional permitido.
    const [session] = (await fetch(`${MOCK()}/__test/stripe/sessions`).then((r) => r.json())).filter((s: { id: string }) => url.endsWith(s.id));
    expect(session.customer_email).toBeNull();
    expect(session.customer_creation).toBe("if_required");
    expect(session.allow_promotion_codes).toBe("true");
    expect(session.currency).toBe("mxn");
    expect(Number(session.line_items[0].price_data.unit_amount)).toBe(18900);
    expect(session.success_url).toMatch(new RegExp(`/compra/${checkout.id}\\?t=`));
    expect(session.cancel_url).toMatch(/\/planes\?plan=MX_5_30&cancelled=1$/);

    await page.goto(url);
    await expect(page.locator("#total")).toHaveText("Total: $189.00 MXN");
    await page.locator("#checkout-email").fill(email);
    await page.locator("#pay").click();
    await page.waitForURL(new RegExp(`/compra/${checkout.id}\\?t=`));

    const success = page.getByTestId("order-success");
    await expect(success).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
    await expect(page.getByTestId("esim-qr")).toBeVisible();
    await expect(page.getByTestId("install-ios")).toHaveAttribute("href", /esimsetup\.apple\.com.*LPA:1\$rsp-test\.simlessly\.com\$TESTCODE/);
    await expect(page.getByTestId("install-android")).toHaveAttribute("href", /esimsetup\.android\.com/);
    await expect(page.getByTestId("activate-when-ready")).toBeVisible();
    await expect(page.getByTestId("order-email")).toHaveText(email);
    await expect(page.getByTestId("total-paid")).toHaveText("$189");
    await expect(page.getByText("rsp-test.simlessly.com").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByTestId("set-password-link")).toHaveAttribute("href", `/recuperar?email=${encodeURIComponent(email)}`);
    const qrSrc = await page.getByTestId("esim-qr").getAttribute("src");
    const qr = await page.request.get(qrSrc!);
    expect(qr.status()).toBe(200);
    expect(qr.headers()["content-type"]).toBe("image/png");

    // Cuenta creada (sin verificar, sin contraseña utilizable) y orden ligada.
    const [user] = await dbQuery<{ id: string; email_verified_at: string | null; balance_cents: number; role: string }>("select * from users where email = $1", [email]);
    expect(user.email_verified_at).toBeNull();
    expect(user.role).toBe("user");
    const paid = await checkoutById(checkout.id);
    expect(paid.status).toBe("fulfilled");
    expect(paid.user_id).toBe(user.id);
    expect(paid.amount_paid_cents).toBe(18900);
    expect(paid.order_id).toBe(checkout.id);

    // Correo con QR (registrado en la orden) y eSIM lista.
    await expect.poll(async () => (await dbQuery<{ emailed_at: string | null }>("select emailed_at from orders where id = $1", [checkout.id]))[0]?.emailed_at, { timeout: 30_000 }).not.toBeNull();
    const [order] = await dbQuery<{ status: string; user_id: string; price_cents: number; provider_order_no: string }>("select * from orders where id = $1", [checkout.id]);
    expect(order).toMatchObject({ status: "ready", user_id: user.id, price_cents: 18900 });
    expect(order.provider_order_no).toBeTruthy();

    // Contabilidad coherente con el monedero: depósito con tarjeta completado + abono + cargo, saldo neto 0.
    const deps = await dbQuery<{ id: string; method: string; status: string; amount_cents: number; external_id: string; meta: { kind: string; provider: string } }>("select * from deposits where user_id = $1", [user.id]);
    expect(deps).toHaveLength(1);
    expect(deps[0]).toMatchObject({ method: "card", status: "completed", amount_cents: 18900, external_id: `stripe:${paid.payment_ref}` });
    expect(deps[0].meta).toMatchObject({ kind: "esim", provider: "stripe" });
    const ledger = await dbQuery<{ amount_cents: number; kind: string; description: string; balance_after_cents: number }>("select * from ledger where user_id = $1 order by created_at", [user.id]);
    expect(ledger.map((l) => [l.kind, l.amount_cents, l.balance_after_cents])).toEqual([
      ["deposit", 18900, 18900],
      ["purchase", -18900, 0],
    ]);
    expect(user.balance_cents).toBe(0);

    // Polling de la página de éxito: token correcto vs. incorrecto.
    const api = await page.request.get(`/api/orders/${checkout.id}?t=${checkout.access_token}`);
    expect(api.status()).toBe(200);
    const view = await api.json();
    expect(view).toMatchObject({ id: checkout.id, status: "ready", email, newAccount: true, paidMxn: 189, currency: "MXN", emailSent: true });
    expect(view.purchase).toMatchObject({ transactionId: checkout.id, value: 189, currency: "MXN" });
    expect(view.esim.qrUrl).toMatch(new RegExp(`^/api/qr/${checkout.id}\\?sig=`));
    expect((await page.request.get(`/api/orders/${checkout.id}?t=nope`)).status()).toBe(404);
    expect((await page.request.get(`/api/orders/${randomUUID()}`, { headers: { cookie: "" } })).status()).toBeGreaterThanOrEqual(401);

    // Embudo: eventos del navegador y del servidor (con la campaña del anuncio), sin correos.
    await expect
      .poll(async () => (await dbQuery<{ event: string }>("select event from funnel_events where visitor = $1", [visitor])).map((r) => r.event).sort(), { timeout: 20_000 })
      .toEqual(expect.arrayContaining(["buy_click", "checkout_redirect", "checkout_started", "page_view", "plan_select"]));
    const server = await dbQuery<{ event: string; ads: boolean; campaign: string; term: string; props: Record<string, unknown> }>(
      "select event, ads, campaign, term, props from funnel_events where campaign = $1 and event in ('checkout_started','paid')",
      [campaign],
    );
    expect(server.map((r) => r.event).sort()).toEqual(["checkout_started", "paid"]);
    expect(server.every((r) => r.ads && r.term === "esim mexico")).toBe(true);
    const buy = await dbQuery<{ props: Record<string, unknown> }>("select props from funnel_events where visitor = $1 and event = 'buy_click'", [visitor]);
    expect(JSON.stringify(buy[0].props)).not.toContain("@");

    // Entrar sin contraseña previa: "crear contraseña" con el código que llega al correo.
    const ctx = await browser.newContext();
    const guest = await ctx.newPage();
    await guest.goto(view.links.setPassword);
    await expect(guest.locator('input[name="email"]')).toHaveValue(email);
    await guest.locator('form button[type="submit"]').click();
    await guest.waitForURL(/\/recuperar\/nueva/);
    await expect.poll(async () => (await dbQuery("select id from email_codes where purpose = 'reset' and user_id = $1", [user.id])).length).toBe(1);
    await dbQuery("update email_codes set code_hash = $1 where purpose = 'reset' and user_id = $2", [createHash("sha256").update("246810").digest("hex"), user.id]);
    await guest.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first().click();
    await guest.keyboard.type("246810");
    await guest.locator('input[name="password"]').fill("ClaveTarjeta2026");
    await guest.locator('form button[type="submit"]').last().click();
    await guest.waitForURL(/\/app/);
    await guest.goto(`/app/esims/${checkout.id}`);
    await expect(guest.getByText("Tu eSIM está lista")).toBeVisible();
    await guest.goto("/app/movimientos");
    await expect(guest.getByText("Pago con tarjeta").filter({ visible: true }).first()).toBeVisible();
    await ctx.close();
  });

  test("con sesión: correo prellenado, la eSIM queda en su cuenta; código promocional", async ({ page }) => {
    test.setTimeout(120_000);
    await register(page);
    const { url, checkout } = await startCheckout(page, "MX_20_30");
    const [{ id: userId }] = await dbQuery<{ id: string }>("select id from users where email = $1", [emailOf(page)]);
    expect(checkout.user_id).toBe(userId);
    const paid = await mock("/__test/stripe/pay", { referenceId: checkout.id, promo: "NOVA10" });
    expect(paid.session.customer_details.email).toBe(emailOf(page));
    expect(paid.events[0].json.result).toBe("order-placed");
    const row = await checkoutById(checkout.id);
    expect(row).toMatchObject({ status: "fulfilled", user_id: userId, amount_paid_cents: 53910, promotion_code: "NOVA10" });
    await page.goto(`/compra/${checkout.id}?t=${checkout.access_token}`);
    await expect(page.getByTestId("order-success")).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
    await expect(page.getByTestId("total-paid")).toHaveText("$539.10");
    await expect(page.getByTestId("set-password-link")).toHaveCount(0);
    await page.goto(`/app/esims/${checkout.id}`);
    await expect(page.getByText("Tu eSIM está lista")).toBeVisible({ timeout: 30_000 });
    void url;
  });

  test("sesión expirada: orden expirada, sin cargos; la página lo explica", async ({ page }) => {
    const { checkout } = await startCheckout(page);
    const r = await mock("/__test/stripe/expire", { referenceId: checkout.id });
    expect(r.status).toBe(200);
    expect(r.json.result).toBe("expired");
    expect((await checkoutById(checkout.id)).status).toBe("expired");
    expect(await dbQuery("select id from orders where id = $1", [checkout.id])).toHaveLength(0);
    await page.goto(`/compra/${checkout.id}?t=${checkout.access_token}`);
    await expect(page.getByTestId("order-success")).toHaveAttribute("data-status", "expired");
    await expect(page.getByText("La página de pago expiró")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver a intentar" })).toHaveAttribute("href", "/planes?plan=MX_5_30");
    // Sin token o con token ajeno: no se muestra nada.
    await page.goto(`/compra/${checkout.id}?t=otro`);
    await expect(page.getByTestId("order-not-found")).toBeVisible();
  });

  test("webhook: firma, deduplicación por evento, idempotencia por sesión; reembolso y disputa se marcan", async ({ page }) => {
    const { checkout } = await startCheckout(page);
    // Firma inválida o vieja → 400.
    expect((await mock("/__test/stripe/webhook", { type: "checkout.session.completed", object: { id: checkout.payment_ref }, badSig: true })).status).toBe(400);
    expect((await mock("/__test/stripe/webhook", { type: "checkout.session.completed", object: { id: checkout.payment_ref }, oldTs: true })).status).toBe(400);
    // Un evento con datos falsos no cumple nada: se re-verifica la sesión en el API (sigue sin pagar).
    const forged = await mock("/__test/stripe/webhook", { type: "checkout.session.completed", object: { id: checkout.payment_ref, payment_status: "paid", status: "complete" } });
    expect(forged.json.result).toBe("unpaid");

    const eventId = `evt_e2e_${randomUUID().slice(0, 12)}`;
    const paid = await mock("/__test/stripe/pay", { referenceId: checkout.id, eventId, email: uniqueEmail("dedupe") });
    expect(paid.events[0].json.result).toBe("order-placed");
    // Mismo evento reenviado → duplicado; evento nuevo de la misma sesión → no se cumple dos veces.
    const replay = await mock("/__test/stripe/webhook", { type: "checkout.session.completed", object: paid.session, eventId });
    expect(replay.json.result).toBe("duplicate");
    const second = await mock("/__test/stripe/webhook", { type: "checkout.session.completed", object: paid.session });
    expect(second.json.result).toBe("duplicate");
    const row = await checkoutById(checkout.id);
    expect(await dbQuery("select id from deposits where external_id = $1", [`stripe:${checkout.payment_ref}`])).toHaveLength(1);
    expect(await dbQuery("select id from ledger where user_id = $1", [row.user_id])).toHaveLength(2);
    expect(await dbQuery("select id from webhook_events where id = $1", [`stripe:${eventId}`])).toHaveLength(1);

    // Reembolso y disputa avisados por Stripe: se marcan y quedan en la bitácora (sin tocar saldos).
    const refund = await mock("/__test/stripe/refund-event", { paymentIntentId: row.payment_intent_id });
    expect(refund.json.result).toBe("flagged");
    expect((await checkoutById(checkout.id)).flag_reason).toBe("refund");
    const dispute = await mock("/__test/stripe/dispute", { paymentIntentId: row.payment_intent_id });
    expect(dispute.json.result).toBe("flagged");
    expect((await checkoutById(checkout.id)).flag_reason).toBe("dispute: fraudulent");
    const audit = await dbQuery<{ action: string; admin_id: string | null }>("select action, admin_id from admin_audit where target_id = $1 order by created_at", [checkout.id]);
    expect(audit).toEqual([
      { action: "payment.refund", admin_id: null },
      { action: "payment.dispute", admin_id: null },
    ]);
  });

  test("planes no vendibles: el de 50 GB está retirado y los inexistentes se rechazan", async ({ page, request }) => {
    for (const planId of ["MX_50_30", "NO_EXISTE"]) {
      const res = await request.post("/api/checkout", { data: { planId } });
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe("unavailable");
    }
    expect((await request.post("/api/checkout", { data: {} })).status()).toBe(400);
    const [plan] = await dbQuery<{ active: boolean }>("select active from plans where id = 'MX_50_30'");
    expect(plan.active).toBe(false);
    // Precios de lista fijos (no costo × tipo de cambio): 3 GB/15 días costaría $129 calculado, se vende en $109.
    const prices = await dbQuery<{ id: string; price_mxn: number }>("select id, price_mxn from plans where id in ('MX_1_7','MX_3_15','MX_5_30','MX_20_30') order by id");
    expect(Object.fromEntries(prices.map((p) => [p.id, p.price_mxn]))).toEqual({ MX_1_7: 39, MX_3_15: 109, MX_5_30: 189, MX_20_30: 599 });
    // Tampoco aparece en la compra con saldo.
    await register(page);
    await page.goto("/app/comprar");
    await expect(page.getByText(/50 GB/)).toHaveCount(0);
  });

  test("admin: embudo y compras con tarjeta visibles", async ({ page }) => {
    const { checkout } = await startCheckout(page);
    await mock("/__test/stripe/pay", { referenceId: checkout.id, email: uniqueEmail("admin-ver") });
    await register(page, { email: uniqueEmail("admin-embudo") });
    await dbQuery("update users set role = 'admin' where email = $1", [emailOf(page)]);
    await page.goto("/admin/embudo");
    await expect(page.getByRole("heading", { name: "Embudo" })).toBeVisible();
    await expect(page.getByTestId("funnel-steps")).toBeVisible();
    expect(Number(await page.getByTestId("funnel-checkouts").textContent())).toBeGreaterThan(0);
    expect(Number(await page.getByTestId("funnel-paid").textContent())).toBeGreaterThan(0);
    await page.goto("/admin/depositos?method=card");
    await expect(page.getByText("Stripe · compra eSIM").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/admin/esims");
    await expect(page.getByText("Tarjeta", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });
});

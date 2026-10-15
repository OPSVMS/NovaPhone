import { test, expect } from "@playwright/test";
import { register, dbQuery, emailOf } from "./helpers";

/** Recarga de saldo con tarjeta (Stripe Checkout, MXN) desde /app/fondos. */
async function startCardPayment(page: import("@playwright/test").Page, amount: number) {
  await page.goto("/app/fondos?metodo=tarjeta");
  const region = page.getByRole("region", { name: "Tarjeta" });
  await region.locator('input[name="amount"]').fill(String(amount));
  await expect(region.getByText(/Pagas/)).toBeVisible();
  await region.getByRole("button", { name: /Pagar con tarjeta/ }).click();
  await page.waitForURL(/\/stripe\/pay\//);
  await expect(page.getByText("Stripe Checkout (test)")).toBeVisible();
}

const cardDeposit = (email: string) =>
  dbQuery<{ id: string; status: string; amount_cents: number; meta: { provider: string; feeCents: number; chargedCents: number; sessionId: string } }>(
    "select d.id, d.status, d.amount_cents, d.meta from deposits d join users u on u.id = d.user_id where u.email = $1 and d.method = 'card' order by d.created_at desc",
    [email],
  );

test.describe("Recarga de saldo con tarjeta (Stripe)", () => {
  test("pago aprobado: regresa a NovaPhone y acredita el saldo con la comisión aparte", async ({ page }) => {
    await register(page);
    await startCardPayment(page, 500);
    // Cuenta conocida: Stripe recibe el correo prellenado; total = saldo + comisión (3.6% + $3 + IVA).
    await expect(page.locator("#email")).toHaveText(emailOf(page));
    await expect(page.locator("#total")).toHaveText("Total: $526.00 MXN");
    await page.locator("#pay").click();
    await page.waitForURL(/\/app\/fondos\/[0-9a-f-]{36}/);
    await expect(page.getByText(/acreditad|Ya está en tu saldo/i).filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$500").filter({ visible: true }).first()).toBeVisible();
    const [d] = await cardDeposit(emailOf(page));
    expect(d.status).toBe("completed");
    expect(d.meta.provider).toBe("stripe");
    expect(d.meta.feeCents).toBe(2600);
    expect(d.meta.chargedCents).toBe(52600);
    await page.goto("/app/movimientos");
    await expect(page.getByText("Depósito con tarjeta").filter({ visible: true }).first()).toBeVisible();
  });

  test("pago cancelado y sesión expirada: no acredita y permite reintentar", async ({ page }) => {
    await register(page);
    await startCardPayment(page, 300);
    await page.locator("#cancel").click();
    await page.waitForURL(/\/app\/fondos\?metodo=tarjeta&monto=300/);
    await expect(page.getByRole("region", { name: "Tarjeta" }).locator('input[name="amount"]')).toHaveValue("300");
    const [d] = await cardDeposit(emailOf(page));
    const r = await fetch(`${process.env.MOCK_URL}/__test/stripe/expire`, { method: "POST", body: JSON.stringify({ referenceId: d.id }) });
    expect((await r.json()).json.result).toBe("expired");
    await page.goto(`/app/fondos/${d.id}`);
    await expect(page.getByText("El pago no se completó")).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$0").filter({ visible: true }).first()).toBeVisible();
  });

  test("el webhook acredita aunque el cliente no regrese, una sola vez", async ({ page }) => {
    await register(page);
    await startCardPayment(page, 200);
    const [d] = await cardDeposit(emailOf(page));
    // El cliente paga pero cierra la pestaña antes de volver.
    const paid = await fetch(`${process.env.MOCK_URL}/__test/stripe/pay`, { method: "POST", body: JSON.stringify({ referenceId: d.id }) }).then((r) => r.json());
    expect(paid.events[0].json.result).toBe("deposit-credited");
    // Reenvío del mismo evento: deduplicado.
    const again = await fetch(`${process.env.MOCK_URL}/__test/stripe/webhook`, {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed", object: paid.session, eventId: paid.events[0].eventId }),
    }).then((r) => r.json());
    expect(again.json.result).toBe("duplicate");
    await page.goto("/app");
    await expect(page.getByText("$200").filter({ visible: true }).first()).toBeVisible();
    const [{ n }] = await dbQuery<{ n: number }>("select count(*)::int n from ledger l join users u on u.id = l.user_id where u.email = $1 and l.kind = 'deposit'", [emailOf(page)]);
    expect(n).toBe(1);
  });
});

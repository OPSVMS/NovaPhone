import { test, expect } from "@playwright/test";
import { register, dbQuery, emailOf } from "./helpers";

async function startCardPayment(page: import("@playwright/test").Page, amount: number) {
  await page.goto("/app/fondos?metodo=tarjeta");
  const region = page.getByRole("region", { name: "Tarjeta" });
  await region.locator('input[name="amount"]').fill(String(amount));
  await expect(region.getByText(/Pagas/)).toBeVisible();
  await region.getByRole("button", { name: /Pagar con tarjeta/ }).click();
  await page.waitForURL(/\/openpay\/pay\//);
  await expect(page.getByText("Openpay Sandbox")).toBeVisible();
}

test.describe("Pago con tarjeta (Openpay)", () => {
  test("pago aprobado: regresa a NovaPhone y acredita el saldo", async ({ page }) => {
    await register(page);
    await startCardPayment(page, 500);
    await page.locator("#pagar").click();
    await page.waitForURL(/\/app\/fondos\/[0-9a-f-]{36}/);
    await expect(page.getByText(/acreditad|listo|Recibimos|confirmado/i).filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$500").filter({ visible: true }).first()).toBeVisible();
    const [d] = await dbQuery<{ status: string; meta: { feeCents: number; chargedCents: number } }>(
      "select d.status, d.meta from deposits d join users u on u.id = d.user_id where u.email = $1 and d.method = 'card'",
      [emailOf(page)],
    );
    expect(d.status).toBe("completed");
    expect(d.meta.chargedCents).toBe(50000 + d.meta.feeCents);
    expect(d.meta.feeCents).toBe(2100); // 2.9% + $2.50 + IVA sobre $500, redondeado
    await page.goto("/app/movimientos");
    await expect(page.getByText("Depósito con tarjeta").filter({ visible: true }).first()).toBeVisible();
  });

  test("pago rechazado: no acredita y permite reintentar", async ({ page }) => {
    await register(page);
    await startCardPayment(page, 300);
    await page.locator("#rechazar").click();
    await page.waitForURL(/\/app\/fondos\/[0-9a-f-]{36}/);
    await expect(page.getByText("El pago no se completó")).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$0").filter({ visible: true }).first()).toBeVisible();
  });

  test("webhook de Openpay sincroniza el cargo aunque el cliente no regrese", async ({ page, request }) => {
    await register(page);
    await startCardPayment(page, 200);
    const chargeId = page.url().split("/").pop()!;
    // El cliente paga pero cierra la pestaña antes de volver.
    await fetch(`${process.env.MOCK_URL}/openpay/pay/${chargeId}/confirm?result=ok`, { redirect: "manual" });
    const [d] = await dbQuery<{ id: string }>("select d.id from deposits d join users u on u.id = d.user_id where u.email = $1 and d.method = 'card'", [emailOf(page)]);
    const hook = await request.post("/api/webhooks/openpay", { data: { type: "charge.succeeded", transaction: { order_id: d.id } } });
    expect(hook.status()).toBe(200);
    await page.goto("/app");
    await expect(page.getByText("$200").filter({ visible: true }).first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { register, requestDeposit, creditSpei, buyPlan, scrollThrough } from "./helpers";

test.describe("Flujo completo de compra", () => {
  test("depósito SPEI → acreditación → compra 20 GB → eSIM lista con QR → movimientos", async ({ page, request }) => {
    await register(page, { name: "Carlos Compra" });
    await expect(page.getByText(/\$0/).filter({ visible: true }).first()).toBeVisible();

    const { reference } = await requestDeposit(page, 700);
    await expect(page.getByText("Esperando tu pago")).toBeVisible();
    await expect(page.getByText("646 180 00000000000 0")).toBeVisible();

    await creditSpei(request, reference, 700);
    await page.reload();
    await expect(page.getByText(/acreditad|listo|Recibimos/i).filter({ visible: true }).first()).toBeVisible();

    await page.goto("/app");
    await expect(page.getByText("$700").filter({ visible: true }).first()).toBeVisible();

    await buyPlan(page, "MX_20_30", /Pagar \$599/);
    await page.waitForURL(/\/app\/esims\/[0-9a-f-]{36}/);
    await expect(page.getByText("Tu eSIM está lista")).toBeVisible({ timeout: 60_000 });

    const qr = page.locator('img[src^="/api/qr/"]');
    await expect(qr).toBeVisible();
    const qrRes = await page.request.get((await qr.getAttribute("src"))!);
    expect(qrRes.status()).toBe(200);
    expect(qrRes.headers()["content-type"]).toBe("image/png");

    await expect(page.getByRole("link", { name: /Instalar en iPhone/ })).toHaveAttribute("href", /esimsetup\.apple\.com.*LPA:1\$rsp-test\.simlessly\.com\$TESTCODE/);
    await expect(page.getByText("rsp-test.simlessly.com").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("e-ideas").filter({ visible: true }).first()).toBeVisible();
    await scrollThrough(page);

    await page.goto("/app/esims");
    await expect(page.getByText(/20GB|20 GB/).filter({ visible: true }).first()).toBeVisible();

    await page.goto("/app/movimientos");
    await expect(page.getByText("Depósito SPEI")).toBeVisible();
    await expect(page.getByText(/eSIM México 20 GB/)).toBeVisible();

    await page.goto("/app");
    await expect(page.getByText("$101").filter({ visible: true }).first()).toBeVisible();
  });

  test("saldo insuficiente: muestra faltante y lleva a fondos con monto", async ({ page }) => {
    await register(page);
    await page.goto("/app/comprar?plan=MX_20_30");
    await expect(page.getByText("Te faltan $599").filter({ visible: true }).first()).toBeVisible();
    await page.locator('a[href="/app/fondos?monto=600"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/app\/fondos\?monto=600/);
    await expect(page.locator('input[name="amount"]')).toHaveValue("600");
  });

  test("falla del proveedor: reembolsa el saldo automáticamente", async ({ page, request }) => {
    await register(page);
    const { reference } = await requestDeposit(page, 200);
    await creditSpei(request, reference, 200);
    await page.goto("/app/comprar?plan=MX_2_7");
    await page.getByRole("button", { name: /^Comprar/ }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Pagar/ }).click();
    await expect(dialog.getByText("No pudimos generar tu eSIM. Te devolvimos el saldo.")).toBeVisible();
    await page.goto("/app/movimientos");
    await expect(page.getByText(/Reembolso/).filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$200").filter({ visible: true }).first()).toBeVisible();
  });

  test("depósito USDT: monto único y acreditación por webhook", async ({ page, request }) => {
    await register(page);
    const { usdt } = await requestDeposit(page, 500, "usdt");
    expect(usdt).toMatch(/^\d+\.\d{4}$/);
    await expect(page.getByText("TTestAddressNovaPhone000000000000")).toBeVisible();
    const { signedDeposit } = await import("./helpers");
    const res = await signedDeposit(request, { method: "usdt", amountUsdt: usdt, externalId: `0xtx${Date.now()}${Math.random()}` });
    expect(res.status()).toBe(200);
    await page.goto("/app");
    await expect(page.getByText("$500").filter({ visible: true }).first()).toBeVisible();
  });
});

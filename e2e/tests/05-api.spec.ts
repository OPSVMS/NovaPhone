import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { register, requestDeposit, signedDeposit } from "./helpers";

test.describe("API y webhooks", () => {
  test("cron exige token", async ({ request }) => {
    expect((await request.get("/api/cron/sync-catalog")).status()).toBe(401);
    const ok = await request.get("/api/cron/sync-catalog", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).fx).toBe(18);
  });

  test("webhook de depósitos: firma inválida, referencia inexistente, idempotencia", async ({ page, request }) => {
    const bad = await signedDeposit(request, { method: "spei", reference: "1", amountMxn: 1, externalId: "x" }, "wrong-secret");
    expect(bad.status()).toBe(401);
    const missing = await signedDeposit(request, { method: "spei", reference: "00000000", amountMxn: 100, externalId: randomUUID() });
    expect(missing.status()).toBe(404);

    await register(page);
    const { usdt } = await requestDeposit(page, 150, "usdt");
    const externalId = `0x${randomUUID()}`;
    const first = await signedDeposit(request, { method: "usdt", amountUsdt: usdt, externalId });
    expect((await first.json()).credited).toBe(true);
    const again = await signedDeposit(request, { method: "usdt", amountUsdt: usdt, externalId });
    expect((await again.json()).duplicate).toBe(true);
    await page.goto("/app");
    await expect(page.getByText("$150").filter({ visible: true }).first()).toBeVisible();
  });

  test("webhook de eSIM Access exige token", async ({ request }) => {
    expect((await request.post("/api/webhooks/esimaccess", { data: {} })).status()).toBe(401);
    const ok = await request.post(`/api/webhooks/esimaccess?token=${process.env.ESIMACCESS_WEBHOOK_TOKEN}`, { data: { notifyType: "CHECK_HEALTH", content: {} } });
    expect(ok.status()).toBe(200);
  });

  test("órdenes y QR protegidos", async ({ request }) => {
    expect((await request.get(`/api/orders/${randomUUID()}`)).status()).toBe(401);
    expect((await request.get(`/api/qr/${randomUUID()}`)).status()).toBe(404);
  });
});

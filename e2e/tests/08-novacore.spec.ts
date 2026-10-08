import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { register, clabeOf, speiToClabe, dbQuery, emailOf } from "./helpers";

const cron = (request: import("@playwright/test").APIRequestContext) =>
  request.get("/api/cron/novacore", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
const replay = async (body: Record<string, unknown>) =>
  (await fetch(`${process.env.MOCK_URL}/__test/novacore/replay`, { method: "POST", body: JSON.stringify(body) })).json() as Promise<{ status: number; json: Record<string, unknown> }>;

test.describe("NOVACORE: CLABE personal y depósitos SPEI", () => {
  test("CLABE personal estable y acreditación por aviso firmado", async ({ page }) => {
    await register(page);
    const clabe = await clabeOf(page);
    await page.reload();
    expect(await clabeOf(page)).toBe(clabe); // idempotente

    const r = await speiToClabe(clabe, 350.5);
    expect(r.callback?.status).toBe(200);
    expect(r.callback?.json.result).toBe("credited");
    await page.goto("/app");
    await expect(page.getByText("$350.50").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app/movimientos");
    await expect(page.getByText("Depósito SPEI").filter({ visible: true }).first()).toBeVisible();
  });

  test("seguridad del aviso: firma, timestamp viejo, nonce repetido y trackingKey duplicado", async ({ page }) => {
    await register(page);
    const clabe = await clabeOf(page);
    const r = await speiToClabe(clabe, 100);
    const dep = { trackingKey: r.deposit.trackingKey, amount: 100, beneficiaryAccount: clabe };

    expect((await replay({ deposit: dep, badSig: true })).status).toBe(401);
    expect((await replay({ deposit: dep, oldTs: true })).status).toBe(401);
    const nonce = randomUUID();
    expect((await replay({ deposit: { ...dep, trackingKey: `NEW${Date.now()}` }, nonce })).status).toBe(200);
    expect((await replay({ deposit: { ...dep, trackingKey: `NEW2${Date.now()}` }, nonce })).status).toBe(409);
    const dup = await replay({ deposit: dep });
    expect(dup.status).toBe(200);
    expect(dup.json.result).toBe("duplicate");

    const [u] = await dbQuery<{ balance_cents: number }>("select balance_cents from users where email = $1", [emailOf(page)]);
    expect(u.balance_cents).toBe(100 * 100 + 100 * 100); // 100 original + 100 del NEW (el NEW2 se rechazó)
  });

  test("conciliación: aviso perdido se acredita y depósito devuelto se revierte", async ({ page, request }) => {
    await register(page);
    const clabe = await clabeOf(page);
    const lost = await speiToClabe(clabe, 250, { send: false });
    expect(lost.callback).toBeNull();
    const c1 = await (await cron(request)).json();
    expect(c1.ok).toBe(true);
    await page.goto("/app");
    await expect(page.getByText("$250").filter({ visible: true }).first()).toBeVisible();

    await fetch(`${process.env.MOCK_URL}/__test/novacore/return`, { method: "POST", body: JSON.stringify({ trackingKey: lost.deposit.trackingKey }) });
    await cron(request);
    await page.goto("/app");
    await expect(page.getByText("$0").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app/movimientos");
    await expect(page.getByText("SPEI devuelto por el banco emisor").filter({ visible: true }).first()).toBeVisible();
    // Repetir la conciliación no vuelve a revertir.
    await cron(request);
    const [u] = await dbQuery<{ balance_cents: number }>("select balance_cents from users where email = $1", [emailOf(page)]);
    expect(u.balance_cents).toBe(0);
  });

  test("cron de NOVACORE exige token", async ({ request }) => {
    expect((await request.get("/api/cron/novacore")).status()).toBe(401);
  });
});

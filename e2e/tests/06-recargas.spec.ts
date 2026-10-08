import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { register, fundAccount, buyReadyEsim, dbQuery, simulateUsage, signedDeposit } from "./helpers";

const GB = 1024 ** 3;
const tranOf = async (orderId: string) => (await dbQuery<{ esim_tran_no: string }>("select esim_tran_no from orders where id = $1", [orderId]))[0].esim_tran_no;

test.describe("Recargas, consumo y pagos recurrentes", () => {
  test("recarga manual suma datos a la misma eSIM", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 1000);
    await buyReadyEsim(page, "MX_1_7", /Pagar \$39/);

    const panel = page.locator("section, div").filter({ has: page.getByText("Recargar esta eSIM", { exact: true }) }).last();
    await panel.getByText("Recargar esta eSIM", { exact: true }).scrollIntoViewIfNeeded();
    await page.locator("label").filter({ hasText: "5 GB" }).filter({ hasText: "+30 días" }).click();
    await page.getByRole("button", { name: /Recargar 5 GB por \$189/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Pagar \$189/ }).click();
    await expect(page.getByText("Recarga aplicada. Tus datos y días ya se sumaron.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("6 GB").filter({ visible: true }).first()).toBeVisible();

    await page.goto("/app/movimientos");
    await expect(page.getByText(/Recarga México 5 GB/).filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$772").filter({ visible: true }).first()).toBeVisible();
  });

  test("auto-recarga por cron cuando se acaban los datos", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 500);
    const orderId = await buyReadyEsim(page, "MX_1_7", /Pagar \$39/);

    await page.locator("label").filter({ hasText: "1 GB" }).filter({ hasText: "+7 días" }).click();
    await page.getByRole("button", { name: /Activar auto-recarga de 1 GB/ }).click();
    await expect(page.getByText(/Auto-recarga\s*activa/).filter({ visible: true }).first()).toBeVisible();

    // Aún hay datos: el cron no recarga.
    await simulateUsage(await tranOf(orderId), 0.2 * GB);
    const cron = () => request.get("/api/cron/sync-usage", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect((await (await cron()).json()).ok).toBe(true);
    expect(await dbQuery("select id from topups where order_id = $1", [orderId])).toHaveLength(0);

    // Se acaban los datos: el cron recarga automáticamente.
    await simulateUsage(await tranOf(orderId), 0.95 * GB);
    await cron();
    const topups = await dbQuery<{ auto: boolean; status: string }>("select auto, status from topups where order_id = $1", [orderId]);
    expect(topups).toEqual([{ auto: true, status: "applied" }]);

    // Sin repetir dentro del periodo de espera.
    await cron();
    expect(await dbQuery("select id from topups where order_id = $1", [orderId])).toHaveLength(1);

    await page.goto("/app/movimientos");
    await expect(page.getByText(/Auto-recarga México 1 GB/).filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$422").filter({ visible: true }).first()).toBeVisible();
  });

  test("auto-recarga por webhook del proveedor y sin saldo no cobra", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 200);
    const orderId = await buyReadyEsim(page, "MX_5_30", /Pagar \$189/);
    await page.locator("label").filter({ hasText: "1 GB" }).filter({ hasText: "+7 días" }).click();
    await page.getByRole("button", { name: /Activar auto-recarga de 1 GB/ }).click();
    await expect(page.getByText(/Auto-recarga\s*activa/).filter({ visible: true }).first()).toBeVisible();

    const tran = await tranOf(orderId);
    await simulateUsage(tran, 4.9 * GB);
    const hook = await request.post(`/api/webhooks/esimaccess?token=${process.env.ESIMACCESS_WEBHOOK_TOKEN}`, {
      data: { notifyType: "DATA_USAGE", content: { esimTranNo: tran } },
    });
    expect(hook.status()).toBe(200);
    // Saldo $11 < $39: no se aplica, se marca aviso por correo.
    expect(await dbQuery("select id from topups where order_id = $1", [orderId])).toHaveLength(0);
    const [o] = await dbQuery<{ low_balance_notified_at: string | null; used_bytes: string }>("select low_balance_notified_at, used_bytes from orders where id = $1", [orderId]);
    expect(o.low_balance_notified_at).not.toBeNull();
    expect(Number(o.used_bytes)).toBeGreaterThan(4 * GB);
    await page.goto("/app");
    await expect(page.getByText("$11").filter({ visible: true }).first()).toBeVisible();
  });

  test("CLABE personal: transferencia sin referencia se acredita sola", async ({ page, request }) => {
    const email = await register(page);
    const clabe = `6461800${String(Date.now()).slice(-10)}${Math.floor(Math.random() * 10)}`;
    await dbQuery("update users set clabe = $1 where email = $2", [clabe, email]);

    await page.goto("/app/fondos");
    await expect(page.getByText("Tu CLABE personal")).toBeVisible();

    const externalId = `SPEI-${randomUUID()}`;
    const res = await signedDeposit(request, { method: "spei", clabe, amountMxn: 599, externalId });
    expect(res.status()).toBe(200);
    const again = await signedDeposit(request, { method: "spei", clabe, amountMxn: 599, externalId });
    expect((await again.json()).duplicate).toBe(true);
    const unknown = await signedDeposit(request, { method: "spei", clabe: "000000000000000000", amountMxn: 10, externalId: randomUUID() });
    expect(unknown.status()).toBe(404);

    await page.goto("/app");
    await expect(page.getByText("$599").filter({ visible: true }).first()).toBeVisible();
  });

  test("consumo y vigencia se muestran tras activarse", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 100);
    const orderId = await buyReadyEsim(page, "MX_1_7", /Pagar \$39/);
    await expect(page.getByText(/empiezan a contar cuando te conectas/)).toBeVisible();
    await simulateUsage(await tranOf(orderId), 0.25 * GB);
    await dbQuery("update orders set usage_synced_at = null where id = $1", [orderId]);
    await page.reload();
    await expect(page.getByText(/7 días/).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("768 MB").filter({ visible: true }).first()).toBeVisible();
  });
});

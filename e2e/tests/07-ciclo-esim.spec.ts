import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { register, fundAccount, buyReadyEsim, dbQuery, simulateUsage } from "./helpers";

const GB = 1024 ** 3;
const tranOf = async (orderId: string) => (await dbQuery<{ esim_tran_no: string }>("select esim_tran_no from orders where id = $1", [orderId]))[0].esim_tran_no;
const hook = (request: import("@playwright/test").APIRequestContext, data: unknown) =>
  request.post(`/api/webhooks/esimaccess?token=${process.env.ESIMACCESS_WEBHOOK_TOKEN}`, { data });

test.describe("Ciclo de vida de la eSIM", () => {
  test("cancelar eSIM no instalada reembolsa el saldo", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 200);
    await buyReadyEsim(page, "MX_5_30", /Pagar \$189/);
    await expect(page.getByText("Pendiente de instalar")).toBeVisible();
    await page.getByRole("button", { name: /Cancelar y reembolsar/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Sí, cancelar y reembolsar/ }).click();
    await expect(page.getByText("eSIM cancelada").first()).toBeVisible();
    await page.goto("/app");
    await expect(page.getByText("$200").filter({ visible: true }).first()).toBeVisible();
    await page.goto("/app/movimientos");
    await expect(page.getByText(/Cancelación México 5 GB/).filter({ visible: true }).first()).toBeVisible();
  });

  test("eSIM instalada: no se puede cancelar, sí pausar y reactivar", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 100);
    const orderId = await buyReadyEsim(page, "MX_1_7", /Pagar \$39/);
    const tran = await tranOf(orderId);
    await simulateUsage(tran, 0.1 * GB);
    // El proveedor avisa que se instaló.
    expect((await hook(request, { notifyType: "SMDP_EVENT", notifyId: randomUUID(), content: { esimTranNo: tran, smdpStatus: "ENABLED", esimStatus: "IN_USE" } })).status()).toBe(200);
    await page.reload();
    await expect(page.getByText("Instalada y encendida")).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancelar y reembolsar/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Pausar eSIM/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Sí, pausar/ }).click();
    await expect(page.getByText("Tu eSIM está en pausa")).toBeVisible();
    await page.getByRole("button", { name: /Reactivar eSIM/ }).click();
    await expect(page.getByText("Tu eSIM está en pausa")).toHaveCount(0);
  });

  test("webhooks: deduplicación por notifyId y aviso de pocos datos", async ({ page, request }) => {
    await register(page);
    await fundAccount(page, request, 100);
    const orderId = await buyReadyEsim(page, "MX_1_7", /Pagar \$39/);
    const tran = await tranOf(orderId);
    await simulateUsage(tran, 0.97 * GB);
    const event = { notifyType: "DATA_USAGE", notifyId: randomUUID(), content: { esimTranNo: tran, remainThreshold: 0.1 } };
    expect((await (await hook(request, event)).json()).result).toBe("usage");
    expect((await (await hook(request, event)).json()).result).toBe("duplicate");
    const [o] = await dbQuery<{ low_data_notified_at: string | null }>("select low_data_notified_at from orders where id = $1", [orderId]);
    expect(o.low_data_notified_at).not.toBeNull();
    expect((await (await hook(request, { notifyType: "CHECK_HEALTH", content: { orderNo: "1234567890" } })).json()).result).toBe("health");
  });
});

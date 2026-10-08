import { test, expect } from "@playwright/test";
import { register, fundAccount, dbQuery, emailOf, PASSWORD } from "./helpers";

test.describe.configure({ mode: "serial" });

const smsHook = (request: import("@playwright/test").APIRequestContext, data: Record<string, unknown>, token = process.env.SMS_WEBHOOK_TOKEN) =>
  request.post(`/api/webhooks/sms/cloudnumbering?token=${token}`, { data });
const cron = (request: import("@playwright/test").APIRequestContext) =>
  request.get("/api/cron/numbers", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });

test("número NovaPhone: inventario (admin) → compra → SMS con código en la bandeja → renovación", async ({ browser, request }, testInfo) => {
  const suffix = testInfo.project.name === "desktop" ? "1" : "2";
  const numbers = [`+44770090${suffix}001`, `+44770090${suffix}002`];

  // Admin agrega números al inventario.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await register(admin, { email: `admin-${testInfo.project.name}-num@novaphone.test`, name: "Admin" });
  await dbQuery("update users set role = 'admin' where email = $1", [emailOf(admin)]);
  await admin.goto("/admin/numeros");
  await admin.locator('textarea[name="numbers"]').fill(numbers.join("\n"));
  await admin.getByRole("button", { name: /Agregar al inventario/ }).click();
  await expect(admin.getByText(/agregados al inventario/)).toBeVisible();

  // Cliente compra su número con saldo.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await register(page);
  await fundAccount(page, request, 200);
  await page.goto("/app/numero");
  await page.getByRole("button", { name: /Obtener mi número/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Pagar \$79/ }).click();
  await expect
    .poll(async () => (await dbQuery("select p.id from phone_numbers p join users u on u.id = p.user_id where u.email = $1", [emailOf(page)])).length, { timeout: 15_000 })
    .toBe(1);
  const [n] = await dbQuery<{ e164: string; status: string }>(
    "select p.e164, p.status from phone_numbers p join users u on u.id = p.user_id where u.email = $1",
    [emailOf(page)],
  );
  expect(n.status).toBe("assigned");
  await page.reload();
  await expect(page.getByText(/Aún no tienes mensajes/)).toBeVisible();

  // SMS entrante por webhook → aparece en la bandeja con el código destacado.
  expect((await smsHook(request, { to: n.e164, from: "WhatsApp", text: "x" }, "bad")).status()).toBe(401);
  const r = await smsHook(request, { to: n.e164.replace("+", ""), from: "WhatsApp", text: "Tu código de WhatsApp: 418-206. No lo compartas.", id: `m-${Date.now()}` });
  expect((await r.json()).result).toBe("stored");
  await expect(page.getByText("418-206").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  expect((await (await smsHook(request, { to: "+440000000000", from: "x", text: "y" })).json()).result).toBe("unknown-number");
  expect(await dbQuery("select l.id from ledger l join users u on u.id = l.user_id where u.email = $1 and l.description like 'Número NovaPhone%'", [emailOf(page)])).toHaveLength(1);

  // Renovación sin saldo → periodo de gracia; al depositar se renueva sola.
  await dbQuery("update users set balance_cents = 0 where email = $1", [emailOf(page)]);
  await dbQuery("update phone_numbers set renews_at = now() - interval '1 minute' where e164 = $1", [n.e164]);
  await cron(request);
  const [g] = await dbQuery<{ grace_until: string | null }>("select grace_until from phone_numbers where e164 = $1", [n.e164]);
  expect(g.grace_until).not.toBeNull();
  await fundAccount(page, request, 100);
  const [after] = await dbQuery<{ grace_until: string | null; renews_at: string }>("select grace_until, renews_at from phone_numbers where e164 = $1", [n.e164]);
  expect(after.grace_until).toBeNull();
  expect(new Date(after.renews_at).getTime()).toBeGreaterThan(Date.now() + 25 * 86400000);

  // Admin: asigna sin costo el otro número a sí mismo y simula SMS.
  await admin.goto("/admin/numeros");
  const assign = admin.locator("form").filter({ has: admin.getByRole("button", { name: /Asignar número/ }) });
  await assign.locator('input[name="email"]').fill(emailOf(admin));
  await assign.getByRole("button", { name: /Asignar número/ }).click();
  await expect(admin.getByText(/asignado a/)).toBeVisible();
  await admin.goto("/app/numero");
  await expect(admin.getByText(/Aún no tienes mensajes/)).toBeVisible();

  // Apagar la renovación libera el número al vencer, con periodo de espera.
  await page.goto("/app/numero");
  await dbQuery("update phone_numbers set auto_renew = false, renews_at = now() - interval '1 minute' where e164 = $1", [n.e164]);
  await cron(request);
  const [rel] = await dbQuery<{ status: string; user_id: string | null; cooldown_until: string }>("select status, user_id, cooldown_until from phone_numbers where e164 = $1", [n.e164]);
  expect(rel.status).toBe("cooldown");
  expect(rel.user_id).toBeNull();
  expect(new Date(rel.cooldown_until).getTime()).toBeGreaterThan(Date.now() + 80 * 86400000);
  await adminCtx.close();
  await ctx.close();
  void PASSWORD;
});

import { test, expect } from "@playwright/test";
import { register, fundAccount, dbQuery, emailOf } from "./helpers";

test.describe.configure({ mode: "serial" });

const hook = (request: import("@playwright/test").APIRequestContext, data: unknown) =>
  request.post(`/api/webhooks/sms/cloudnumbering?token=${process.env.SMS_WEBHOOK_TOKEN}`, { data });

test("sin inventario: se compra un número en cloudnumbering al momento, con SMS ruteado a NovaPhone", async ({ page, request }) => {
  await register(page);
  await fundAccount(page, request, 100);
  // Agota el inventario libre justo antes de comprar para forzar la compra automática.
  await dbQuery("update phone_numbers set status = 'retired' where status in ('available','cooldown')");
  await page.goto("/app/numero");
  await page.getByRole("button", { name: /Obtener mi número/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Pagar \$79/ }).click();
  await expect
    .poll(async () => (await dbQuery("select p.id from phone_numbers p join users u on u.id = p.user_id where u.email = $1", [emailOf(page)])).length, { timeout: 20_000 })
    .toBe(1);
  const [n] = await dbQuery<{ e164: string; provider_ref: string }>(
    "select p.e164, p.provider_ref from phone_numbers p join users u on u.id = p.user_id where u.email = $1",
    [emailOf(page)],
  );
  expect(n.provider_ref).toMatch(/^AN/);
  const state = (await (await fetch(`${process.env.MOCK_URL}/__test/cn/numbers`)).json()) as { numbers: { sid: string; smsEndpointSid: string }[]; endpoints: { sid: string; uri: string }[] };
  const ep = state.endpoints.find((e) => e.uri.includes("/api/webhooks/sms/cloudnumbering?token="));
  expect(ep).toBeTruthy();
  expect(state.numbers.find((x) => x.sid === n.provider_ref)?.smsEndpointSid).toBe(ep!.sid);

  // Formato real de cloudnumbering: { to, from, content, country, parts }, sin id → deduplicado por contenido.
  const sms = { to: n.e164, from: "WhatsApp", content: "Tu código de WhatsApp es 551-302", country: "GB", country_name: "United Kingdom", parts: 1 };
  expect((await (await hook(request, sms)).json()).result).toBe("stored");
  expect((await (await hook(request, sms)).json()).result).toBe("duplicate");
  await page.reload();
  await expect(page.getByText("551-302").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });

  // Campos faltantes nunca regresan error (un no-2xx haría que el mensaje se pierda).
  const empty = await hook(request, { from: "x" });
  expect(empty.status()).toBe(200);
  const noContent = await hook(request, { to: n.e164, from: "Banco" });
  expect((await noContent.json()).result).toBe("stored");
});

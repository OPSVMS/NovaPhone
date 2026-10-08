import { test, expect, type Page } from "@playwright/test";
import { scrollThrough, speiToClabe, dbQuery, PASSWORD, login } from "./helpers";

/**
 * Recorrido completo como usuario normal, navegando con los menús (no con URLs directas):
 * landing → registro → fondos (SPEI/tarjeta/USDT) → depósito → compra → eSIM → recarga → auto-recarga
 * → número + SMS → movimientos → cerrar sesión → volver a entrar. Falla si hay errores de JS o respuestas 5xx.
 */
test("recorrido completo del usuario sin errores", async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  let step = 0;
  const snap = async (name: string) => {
    await scrollThrough(page);
    await page.screenshot({ path: testInfo.outputPath(`${String(++step).padStart(2, "0")}-${name}.png`), fullPage: true });
  };
  const nav = (p: Page, label: string) => p.getByRole("link", { name: label, exact: true }).filter({ visible: true }).first();

  // 1. Landing y registro desde el CTA.
  await page.goto("/");
  await snap("landing");
  await page.getByRole("link", { name: /Crear cuenta/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/registro/);
  const email = `recorrido+${Date.now()}${Math.floor(Math.random() * 1e4)}@novaphone.test`;
  await page.locator('input[name="name"]').fill("María Recorrido");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/app/);
  await expect(page.getByText(/María/).filter({ visible: true }).first()).toBeVisible();
  await snap("inicio-vacio");

  // 2. Fondos: los tres métodos.
  await nav(page, "Fondos").click();
  await expect(page.getByText("Tu CLABE personal").first()).toBeVisible();
  await snap("fondos-spei");
  await page.getByRole("radio", { name: /Tarjeta/ }).click();
  const card = page.getByRole("region", { name: "Tarjeta" });
  await card.locator('input[name="amount"]').fill("300");
  await expect(card.getByText(/Pagas/)).toBeVisible();
  await snap("fondos-tarjeta");
  await page.getByRole("radio", { name: /USDT/ }).click();
  await expect(page.getByRole("region", { name: "USDT" })).toBeVisible();

  // Depósito real a su CLABE (simulado en NOVACORE).
  const [{ clabe }] = await dbQuery<{ clabe: string }>("select clabe from users where email = $1", [email]);
  expect((await speiToClabe(clabe, 1000)).callback?.json.result).toBe("credited");
  await nav(page, "Inicio").click();
  await expect(page.getByText("$1,000").filter({ visible: true }).first()).toBeVisible();

  // 3. Comprar un plan desde el menú.
  await nav(page, "Comprar").click();
  await page.locator("label").filter({ hasText: "5 GB" }).first().click();
  await snap("comprar");
  await page.getByRole("button", { name: /^Comprar/ }).filter({ visible: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Pagar \$189/ }).click();
  await page.waitForURL(/\/app\/esims\/[0-9a-f-]{36}/);
  await expect(page.getByText("Tu eSIM está lista")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('img[src^="/api/qr/"]')).toBeVisible();
  await snap("esim-lista");

  // 4. Recarga manual y auto-recarga en la misma eSIM.
  await page.locator("label").filter({ hasText: "1 GB" }).filter({ hasText: "+7 días" }).click();
  await page.getByRole("button", { name: /Recargar 1 GB por \$39/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Pagar \$39/ }).click();
  await expect(page.getByText(/Recarga aplicada/)).toBeVisible();
  await page.getByRole("button", { name: /Activar auto-recarga/ }).click();
  await expect(page.getByText(/Auto-recarga\s*activa/).filter({ visible: true }).first()).toBeVisible();

  // 5. Número NovaPhone: compra, SMS y ajustes.
  await nav(page, "Número").click();
  await snap("numero-sin");
  await page.getByRole("button", { name: /Obtener mi número/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Pagar \$79/ }).click();
  await expect(page.getByText(/Aún no recibes mensajes/)).toBeVisible({ timeout: 20_000 });
  const [{ e164 }] = await dbQuery<{ e164: string }>("select p.e164 from phone_numbers p join users u on u.id = p.user_id where u.email = $1", [email]);
  await request.post(`/api/webhooks/sms/cloudnumbering?token=${process.env.SMS_WEBHOOK_TOKEN}`, {
    data: { to: e164, from: "WhatsApp", content: `Tu código de WhatsApp: 731-904 ${Date.now()}`, country: "GB", parts: 1 },
  });
  await expect(page.getByText("731-904").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  const sw = page.getByRole("switch").first();
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await snap("numero-bandeja");

  // 6. Mis eSIM y movimientos.
  await nav(page, "Mis eSIM").click();
  await expect(page.getByText(/México 5 GB/).filter({ visible: true }).first()).toBeVisible();
  await snap("mis-esim");
  await page.goto("/app/movimientos");
  for (const t of ["Depósito SPEI", "eSIM México 5 GB", "Recarga México 1 GB", "Número NovaPhone"]) {
    await expect(page.getByText(new RegExp(t)).filter({ visible: true }).first()).toBeVisible();
  }
  await snap("movimientos");
  // Saldo final: 1000 − 189 − 39 − 79 = 693
  await nav(page, "Inicio").click();
  await expect(page.getByText("$693").filter({ visible: true }).first()).toBeVisible();
  await snap("inicio-final");

  // 7. Cerrar sesión y volver a entrar.
  await page.getByRole("button", { name: "Menú de cuenta" }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: /Cerrar sesión/ }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await login(page, email);
  await page.waitForURL(/\/app/);
  await expect(page.getByText("$693").filter({ visible: true }).first()).toBeVisible();

  expect(problems, problems.join("\n")).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { register, login, dbQuery, PASSWORD } from "./helpers";

test("recuperar contraseña con código y entrar con la nueva", async ({ page, browser }) => {
  const email = await register(page);
  await page.context().clearCookies();

  await page.goto("/entrar");
  await page.getByRole("link", { name: /Olvidaste tu contraseña/ }).click();
  await expect(page).toHaveURL(/\/recuperar/);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/recuperar\/nueva/);

  // El correo está deshabilitado en pruebas: fijamos un código conocido en la base.
  await expect.poll(async () => (await dbQuery("select c.id from email_codes c join users u on u.id = c.user_id where u.email = $1 and c.purpose = 'reset'", [email])).length).toBe(1);
  await dbQuery(
    "update email_codes set code_hash = $1 where purpose = 'reset' and user_id = (select id from users where email = $2)",
    [createHash("sha256").update("482913").digest("hex"), email],
  );
  const otp = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first();
  await otp.click();
  await page.keyboard.type("482913");
  await page.locator('input[name="password"]').fill("NuevaClave2026");
  await page.locator('form button[type="submit"]').last().click();
  await page.waitForURL(/\/app/);

  const other = await (await browser.newContext()).newPage();
  await login(other, email, PASSWORD);
  await expect(other.getByText("Correo o contraseña incorrectos.")).toBeVisible();
  await login(other, email, "NuevaClave2026");
  await other.waitForURL(/\/app/);
});

test("recuperar no revela si la cuenta existe", async ({ page }) => {
  await page.goto("/recuperar");
  await page.locator('input[name="email"]').fill("noexiste@novaphone.test");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/recuperar\/nueva/);
});

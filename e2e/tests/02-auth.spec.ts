import { test, expect } from "@playwright/test";
import { register, login, uniqueEmail, PASSWORD } from "./helpers";

test.describe("Cuenta", () => {
  test("registro valida contraseña corta y correo duplicado", async ({ page }) => {
    const email = await register(page);
    await page.context().clearCookies();
    await page.goto("/registro");
    await page.locator('input[name="name"]').fill("Otro");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill("123");
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/registro/);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("Ya existe una cuenta con ese correo.")).toBeVisible();
  });

  test("registro con plan lleva a comprar ese plan", async ({ page }) => {
    await register(page, { plan: "MX_5_30" });
    await expect(page).toHaveURL(/\/app\/comprar\?plan=MX_5_30/);
    await expect(page.getByText("Te faltan").filter({ visible: true }).first()).toBeVisible();
  });

  test("login incorrecto, login correcto, cerrar sesión", async ({ page }) => {
    const email = await register(page, { name: "Ana López" });
    await page.context().clearCookies();
    await login(page, email, "malapass123");
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await login(page, email.toUpperCase());
    await page.waitForURL(/\/app$/);
    await expect(page.getByText(/Ana/).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Menú de cuenta" }).first().click();
    await page.getByRole("button", { name: /Cerrar sesión/ }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await page.goto("/app");
    await expect(page).toHaveURL(/entrar/);
  });

  test("usuario con sesión no ve registro/entrar", async ({ page }) => {
    await register(page);
    await page.goto("/entrar");
    await expect(page).toHaveURL(/\/app/);
    await page.goto("/registro");
    await expect(page).toHaveURL(/\/app/);
  });

  test("usuario normal no entra a admin", async ({ page }) => {
    await register(page, { email: uniqueEmail("normal") });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app$/);
  });
});

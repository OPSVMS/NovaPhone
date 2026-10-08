import { test, expect } from "@playwright/test";
import { scrollThrough } from "./helpers";

test.describe("Sitio público", () => {
  test("home: recorre toda la página y todas las secciones aparecen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Internet 5G");
    await scrollThrough(page);
    for (const text of ["Conectado a la red Telcel 5G", "Sin registros ni papeleo", "Navega sin restricciones", "Elige tus datos", "Cuatro pasos", "compatible", "Lo que todos preguntan"]) {
      const el = page.getByText(text, { exact: false }).filter({ visible: true }).first();
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeVisible();
    }
    await expect(page.getByText("$599").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/no está afiliado/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("FAQ: abre y cierra respuestas", async ({ page }) => {
    await page.goto("/");
    const q = page.getByRole("button", { name: /¿Me piden CURP/ });
    await q.scrollIntoViewIfNeeded();
    await q.click();
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await q.click();
    await expect(q).toHaveAttribute("aria-expanded", "false");
  });

  test("navegación: menú, planes y CTA a registro con plan", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: "Abrir menú" }).click();
      const menu = page.getByRole("dialog", { name: "Menú" });
      await expect(menu).toBeVisible();
      await menu.getByRole("link", { name: "Planes" }).click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Planes" }).click();
    }
    await expect(page).toHaveURL(/planes/);
    await page.goto("/planes");
    await expect(page.getByText("20 GB").filter({ visible: true }).first()).toBeVisible();
    await page.locator('a[href*="/registro?plan=MX_20_30"]').first().click();
    await expect(page).toHaveURL(/\/registro\?plan=MX_20_30/);
  });

  test("páginas legales y SEO", async ({ page, request }) => {
    for (const p of ["/terminos", "/privacidad"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    expect((await request.get("/opengraph-image")).status()).toBe(200);
    expect((await request.get("/icon.svg")).status()).toBe(200);
  });

  test("rutas privadas redirigen a entrar conservando next", async ({ page }) => {
    await page.goto("/app/comprar?plan=MX_5_30");
    await expect(page).toHaveURL(/\/entrar\?next=/);
    expect(decodeURIComponent(page.url())).toContain("/app/comprar?plan=MX_5_30");
  });
});

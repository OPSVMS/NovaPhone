import { test, expect, type Page } from "@playwright/test";

/**
 * Landing de venta (home): picker con 3 planes, 20 GB preseleccionado, barra fija en celular y botón de compra
 * que llama a `startCardCheckout` → Stripe Checkout (simulador en e2e/mock, /stripe/pay/{id}).
 */

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("Landing de venta", () => {
  test("hero y picker: 3 planes visibles, 20 GB recomendado y preseleccionado", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Internet para tu celular");
    await expect(page.getByText("Red Telcel 5G · paga con tarjeta o SPEI · QR al instante")).toBeVisible();

    const picker = page.getByTestId("plan-picker").first();
    await expect(picker).toBeVisible();
    // Visibles: 5 GB, 20 GB y 10 GB (si el catálogo lo tiene; el de E2E no). 1 GB queda detrás de "Ver más planes".
    for (const id of ["MX_5_30", "MX_20_30"]) await expect(picker.getByTestId(`plan-${id}`)).toBeVisible();
    await expect(picker.getByTestId("plan-MX_1_7")).toHaveCount(0);
    expect(await picker.getByRole("radio").count()).toBeLessThanOrEqual(3);
    await expect(page.getByText("1,829")).toHaveCount(0); // 50 GB ya no se ofrece

    const rec = picker.getByTestId("plan-MX_20_30");
    await expect(rec).toContainText("Recomendado");
    await expect(rec.getByRole("radio")).toBeChecked();
    const recPrice = await picker.getByTestId("price-MX_20_30").innerText();
    await expect(picker.getByTestId("buy-button")).toContainText(`Comprar ahora — ${recPrice} MXN`);

    // Confianza junto al botón.
    await expect(page.getByTestId("trust-chips")).toContainText("QR en 2 min");
    await expect(page.getByTestId("trust-chips")).toContainText("Garantía de conexión");
    await expect(page.getByTestId("trust-chips")).toContainText("Pago seguro Stripe");
    await expect(picker.getByTestId("payment-row")).toHaveText(
      "Pago seguro con Stripe · Visa, Mastercard, Amex, Apple Pay, Google Pay · o SPEI",
    );
    await expect(picker.getByTestId("guarantee")).toHaveAttribute("href", "/reembolsos");
    await expect(picker.getByTestId("spei-link")).toHaveAttribute("href", "/app/comprar?plan=MX_20_30");

    // Nada de cripto ni "US$" en la página pública.
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("usdt");
    expect(body).not.toContain("us$");
    expect(errors).toEqual([]);
  });

  test("cambiar de plan y 'Ver más planes'", async ({ page }) => {
    await page.goto("/");
    const picker = page.getByTestId("plan-picker").first();
    await picker.getByTestId("plan-MX_5_30").click();
    await expect(picker.getByTestId("plan-MX_5_30").getByRole("radio")).toBeChecked();
    const p5 = await picker.getByTestId("price-MX_5_30").innerText();
    await expect(picker.getByTestId("buy-button")).toContainText(`${p5} MXN`);
    await expect(picker.getByTestId("spei-link")).toHaveAttribute("href", "/app/comprar?plan=MX_5_30");

    await picker.getByTestId("more-plans").click();
    await expect(picker.getByTestId("plan-MX_1_7")).toBeVisible();
    await picker.getByTestId("plan-MX_1_7").click();
    const p1 = await picker.getByTestId("price-MX_1_7").innerText();
    await expect(picker.getByTestId("buy-button")).toContainText(`${p1} MXN`);
  });

  test("?plan= preselecciona (regreso de un pago cancelado)", async ({ page }) => {
    await page.goto("/?plan=MX_1_7&cancelled=1");
    const picker = page.getByTestId("plan-picker").first();
    await expect(picker.getByTestId("plan-MX_1_7").getByRole("radio")).toBeChecked();
    await expect(picker.getByText("No se hizo ningún cargo")).toBeVisible();
  });

  test("barra fija en celular con el precio del plan elegido", async ({ page, isMobile }) => {
    test.skip(!isMobile, "La barra fija es solo para celular");
    await page.goto("/");
    const bar = page.getByTestId("sticky-bar");
    // Lejos del botón del picker (p. ej. en las preguntas), la barra se ve.
    await page.locator("#preguntas").scrollIntoViewIfNeeded();
    await expect(bar).toHaveAttribute("data-sticky-bar", "on");
    const recPrice = await page.getByTestId("price-MX_20_30").innerText();
    await expect(page.getByTestId("sticky-buy")).toContainText(`Comprar ahora — ${recPrice} MXN`);
    await expect(page.getByTestId("sticky-whatsapp")).toHaveAttribute("href", "https://wa.me/message/CMMXYJLZ353VC1");
    // Con el botón del picker en pantalla, la barra se esconde.
    await page.getByTestId("buy-button").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(bar).toHaveAttribute("data-sticky-bar", "off");
    // Elegir otro plan actualiza la barra.
    await page.getByTestId("plan-MX_5_30").click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).toHaveAttribute("data-sticky-bar", "on");
    await expect(page.getByTestId("sticky-buy")).toContainText(`${await page.getByTestId("price-MX_5_30").innerText()} MXN`);
  });

  // El simulador de eSIM Access solo tiene 1, 2, 5 y 20 GB activos: se compra 5 GB (no el preseleccionado).
  test("comprar: llama a startCardCheckout y redirige a Stripe (mock) con el plan elegido", async ({ page, isMobile }) => {
    await page.goto("/");
    await page.getByTestId("plan-MX_5_30").click();
    const price = (await page.getByTestId("price-MX_5_30").innerText()).replace(/[^0-9]/g, "");
    const action = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    if (isMobile) {
      await page.locator("#preguntas").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("sticky-bar")).toHaveAttribute("data-sticky-bar", "on");
      await page.getByTestId("sticky-buy").click();
    } else {
      await page.getByTestId("buy-button").click();
    }
    await action; // la server action se invocó
    await page.waitForURL(/\/stripe\/pay\/cs_/, { timeout: 30_000 });
    await expect(page.locator("#total")).toContainText(`${Number(price).toLocaleString("en-US")}.00 MXN`.replace(",", ""));
  });

  test("FAQ: 5 preguntas, respuesta legal exacta (POLICY §6.2) y WhatsApp", async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("#preguntas");
    await faq.scrollIntoViewIfNeeded();
    await expect(faq.getByRole("button")).toHaveCount(5);
    const q = faq.getByRole("button", { name: "¿Tengo que vincular la eSIM de NovaPhone con mi CURP?" });
    await q.click();
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(
      faq.getByText(/^La vinculación de líneas con CURP que coordina la CRT aplica a las líneas móviles con número telefónico\./),
    ).toBeVisible();
    // Frases prohibidas por la política de anuncios.
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/sin registro|papeleo|no pedimos curp|\bINE\b/i);
    await faq.getByRole("button", { name: /¿Cómo pago/ }).click();
    await expect(faq.getByText(/tarjeta.*Stripe.*SPEI/)).toBeVisible();
    await expect(faq.getByTestId("faq-whatsapp")).toHaveAttribute("href", "https://wa.me/message/CMMXYJLZ353VC1");
    await expect(page.getByRole("contentinfo")).toContainText("MASMOVIL S.A. de C.V.");
    await expect(page.getByRole("contentinfo")).toContainText("Guadalajara");
  });

  test("SEO: JSON-LD de Organization, Product y FAQPage; /planes y /reembolsos", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/eSIM México/);
    const types = await page.locator('script[type="application/ld+json"]').evaluateAll((els) =>
      els.map((e) => (JSON.parse(e.textContent || "{}") as { "@type": string })["@type"]),
    );
    expect(types).toEqual(expect.arrayContaining(["Organization", "Product", "FAQPage"]));
    const product = await page.locator('script[type="application/ld+json"]').evaluateAll((els) =>
      els.map((e) => JSON.parse(e.textContent || "{}")).find((j) => j["@type"] === "Product"),
    );
    expect(product.offers.priceCurrency).toBe("MXN");
    expect(product.offers.highPrice).toBeGreaterThan(0);
    expect(product.offers.offers.some((o: { sku: string }) => o.sku === "MX_50_30")).toBe(false);

    await page.goto("/planes");
    await expect(page.getByTestId("plan-MX_1_7")).toBeVisible();
    await expect(page.getByTestId("plan-MX_20_30").getByRole("radio")).toBeChecked();

    await page.goto("/reembolsos");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Política de reembolsos");
    await expect(page.getByText(/30 días/).first()).toBeVisible();

    const og = await request.get("/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
  });
});

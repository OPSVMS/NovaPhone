import { test, expect, type Page } from "@playwright/test";

/**
 * Landing de venta (home): picker con todos los planes a la vista (1 GB "Para probar", 20 GB recomendado y
 * preseleccionado), barra fija en celular que nunca tapa la lista, y botón de compra
 * que llama a `startCardCheckout` → Stripe Checkout (simulador en e2e/mock, /stripe/pay/{id}).
 */

async function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("Landing de venta", () => {
  test("hero y picker: todos los planes visibles, 1 GB para probar, 20 GB recomendado y preseleccionado", async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Internet para tu celular");
    await expect(page.getByText("Red Telcel 5G · paga con tarjeta o SPEI · QR al instante")).toBeVisible();

    const picker = page.getByTestId("plan-picker").first();
    await expect(picker).toBeVisible();
    // Todos los planes ofrecidos a la vez, sin "Ver más planes" (el catálogo de E2E tiene 1, 3/15, 5 y 20 GB;
    // producción además 3/30 y 10 GB). Orden de menor a mayor: 1 GB primero, 20 GB al final.
    await expect(picker.getByTestId("more-plans")).toHaveCount(0);
    const shown = ["MX_1_7", "MX_3_15", "MX_5_30", "MX_20_30"];
    for (const id of shown) await expect(picker.getByTestId(`plan-${id}`)).toBeVisible();
    const ids = await picker.locator('[data-testid^="plan-MX_"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(ids.length).toBeGreaterThanOrEqual(shown.length);
    expect(ids.length).toBeLessThanOrEqual(6);
    expect(ids[0]).toBe("plan-MX_1_7");
    expect(ids.at(-1)).toBe("plan-MX_20_30");
    await expect(picker.getByRole("radio")).toHaveCount(ids.length);
    await expect(page.getByText("1,829")).toHaveCount(0); // 50 GB ya no se ofrece
    await expect(picker.getByTestId("plan-MX_2_7")).toHaveCount(0); // en el catálogo, pero no se publicita

    // Precio por GB bajo cada precio.
    const p20 = Number((await picker.getByTestId("price-MX_20_30").innerText()).replace(/[^0-9]/g, ""));
    await expect(picker.getByTestId("per-gb-MX_20_30")).toHaveText(`$${Math.round(p20 / 20)}/GB`);
    await expect(picker.getByTestId("per-gb-MX_1_7")).toHaveText(/^\$\d+\/GB$/);

    // 1 GB: insignia "Para probar" y nota para la primera compra.
    const trial = picker.getByTestId("plan-MX_1_7");
    await expect(trial.getByTestId("badge-trial")).toHaveText(/para probar/i);
    await expect(picker.getByTestId("badge-trial")).toHaveCount(1);
    const p1 = await picker.getByTestId("price-MX_1_7").innerText();
    await expect(picker.getByTestId("trial-note")).toHaveText(
      `¿Primera vez? Prueba con 1 GB por ${p1} y recarga después desde tu panel.`,
    );

    const rec = picker.getByTestId("plan-MX_20_30");
    await expect(rec.getByTestId("badge-recommended")).toHaveText(/recomendado/i);
    await expect(picker.getByTestId("badge-recommended")).toHaveCount(1);
    await expect(rec.getByRole("radio")).toBeChecked();
    await expect(picker.getByRole("radio", { checked: true })).toHaveCount(1);
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

  test("cambiar de plan y la nota 'Prueba con 1 GB' elige el de 1 GB", async ({ page }) => {
    await page.goto("/");
    const picker = page.getByTestId("plan-picker").first();
    await picker.getByTestId("plan-MX_5_30").click();
    await expect(picker.getByTestId("plan-MX_5_30").getByRole("radio")).toBeChecked();
    const p5 = await picker.getByTestId("price-MX_5_30").innerText();
    await expect(picker.getByTestId("buy-button")).toContainText(`${p5} MXN`);
    await expect(picker.getByTestId("spei-link")).toHaveAttribute("href", "/app/comprar?plan=MX_5_30");

    await picker.getByTestId("trial-note").getByRole("button", { name: /Prueba con 1 GB/ }).click();
    await expect(picker.getByTestId("plan-MX_1_7").getByRole("radio")).toBeChecked();
    const p1 = await picker.getByTestId("price-MX_1_7").innerText();
    await expect(picker.getByTestId("buy-button")).toContainText(`${p1} MXN`);
    await expect(picker.getByTestId("spei-link")).toHaveAttribute("href", "/app/comprar?plan=MX_1_7");
  });

  test("?plan= preselecciona (regreso de un pago cancelado)", async ({ page }) => {
    await page.goto("/?plan=MX_1_7&cancelled=1");
    const picker = page.getByTestId("plan-picker").first();
    await expect(picker.getByTestId("plan-MX_1_7").getByRole("radio")).toBeChecked();
    await expect(picker.getByText("No se hizo ningún cargo")).toBeVisible();
  });

  test("barra fija en celular con el precio del plan elegido; nunca tapa la lista", async ({ page, isMobile }) => {
    test.skip(!isMobile, "La barra fija es solo para celular");
    await page.goto("/");
    const bar = page.getByTestId("sticky-bar");
    // Sin scroll, la lista se ve (hero compacto) y la barra no la tapa.
    await expect(page.getByTestId("plan-MX_1_7")).toBeInViewport();
    await expect(bar).toHaveAttribute("data-sticky-bar", "off");
    // Con el último plan pegado al borde inferior, la barra sigue escondida (no lo tapa).
    await page.getByTestId("plan-MX_20_30").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await expect(page.getByTestId("plan-MX_20_30")).toBeInViewport({ ratio: 1 });
    await expect(bar).toHaveAttribute("data-sticky-bar", "off");
    // Hero + lista + botón de compra a un scroll: el botón queda dentro de las dos primeras pantallas.
    const buyBottom = await page.getByTestId("buy-button").evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    expect(buyBottom).toBeLessThan(2 * page.viewportSize()!.height);
    // Sin desbordamiento horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

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

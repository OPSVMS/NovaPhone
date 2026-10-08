import { expect, type Page, type APIRequestContext } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";

export const PASSWORD = "SuperSegura123";
export const uniqueEmail = (tag = "user") => `${tag}+${randomUUID().slice(0, 8)}@novaphone.test`;

export async function register(page: Page, opts: { email?: string; name?: string; plan?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  await page.goto(opts.plan ? `/registro?plan=${opts.plan}` : "/registro");
  await page.locator('input[name="name"]').fill(opts.name ?? "Usuario Prueba");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/app/);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/entrar");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
}

/** Solicita un depósito desde la UI y regresa la referencia (y monto USDT si aplica). */
export async function requestDeposit(page: Page, amount: number, method: "spei" | "usdt" = "spei") {
  await page.goto("/app/fondos");
  if (method === "usdt") await page.getByRole("radio", { name: /USDT/ }).click();
  const input = page.locator('input[name="amount"]');
  await input.fill(String(amount));
  await input.locator("xpath=ancestor::form").locator('button[type="submit"]').click();
  await page.waitForURL(/\/app\/fondos\/[0-9a-f-]{36}/);
  const reference = (await page.locator(".font-mono").filter({ hasText: /^\d{8}$/ }).first().textContent())!.trim();
  let usdt: string | undefined;
  if (method === "usdt") {
    const text = await page.getByText(/Envía exactamente/).textContent();
    usdt = text!.match(/(\d+\.\d{4}) USDT/)![1];
  }
  return { reference, usdt, url: page.url() };
}

export function signedDeposit(request: APIRequestContext, body: Record<string, unknown>, secret = process.env.DEPOSITS_WEBHOOK_SECRET!) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return request.post("/api/webhooks/deposits", { data: raw, headers: { "content-type": "application/json", "x-novaphone-signature": sig } });
}

export async function creditSpei(request: APIRequestContext, reference: string, amountMxn: number) {
  const res = await signedDeposit(request, { method: "spei", reference, amountMxn, externalId: `SPEI-${randomUUID()}` });
  expect(res.status()).toBe(200);
  expect((await res.json()).credited).toBe(true);
}

/** Saldo visible en la app (pill de saldo). */
export async function balanceText(page: Page) {
  await page.goto("/app");
  return page.locator("body").innerText();
}

/** Recorre toda la página con scroll para disparar las animaciones de entrada. */
export async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 400) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(60);
  }
}

export async function buyPlan(page: Page, plan: string, priceLabel: RegExp) {
  await page.goto(`/app/comprar?plan=${plan}`);
  await page.getByRole("button", { name: /^Comprar/ }).filter({ visible: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Confirma tu compra")).toBeVisible();
  await dialog.getByRole("button", { name: priceLabel }).click();
}

/** Consulta directa a Postgres vía el proxy HTTP (solo pruebas). */
export async function dbQuery<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const res = await fetch(process.env.NEON_SQL_URL!, {
    method: "POST",
    headers: { "Neon-Connection-String": process.env.DB_URL!, "content-type": "application/json" },
    body: JSON.stringify({ query, params }),
  });
  const json = (await res.json()) as { rows?: T[]; message?: string };
  if (!json.rows) throw new Error(`dbQuery failed: ${JSON.stringify(json)}`);
  return json.rows;
}

/** Simula consumo de datos (y activación) en el proveedor simulado. */
export async function simulateUsage(esimTranNo: string, usedBytes: number) {
  await fetch(`${process.env.MOCK_URL}/__test/usage`, { method: "POST", body: JSON.stringify({ esimTranNo, usedBytes }) });
}

export async function fundAccount(page: Page, request: APIRequestContext, amount: number) {
  const { reference } = await requestDeposit(page, amount);
  await creditSpei(request, reference, amount);
}

/** Compra un plan y espera a que la eSIM esté lista. Regresa el id de la orden. */
export async function buyReadyEsim(page: Page, plan: string, price: RegExp) {
  await buyPlan(page, plan, price);
  await page.waitForURL(/\/app\/esims\/[0-9a-f-]{36}/);
  await expect(page.getByText("Tu eSIM está lista")).toBeVisible({ timeout: 60_000 });
  return page.url().split("/").pop()!;
}

import { test, expect } from "@playwright/test";
import { register, requestDeposit } from "./helpers";

test.describe.configure({ mode: "serial" });

test("admin aprueba un depósito pendiente y el usuario recibe el saldo", async ({ browser }, testInfo) => {
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await register(user, { name: "Cliente Pendiente" });
  const { reference } = await requestDeposit(user, 300, "usdt");

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await register(admin, { email: `admin-${testInfo.project.name}@novaphone.test`, name: "Admin" });
  await admin.goto("/admin");
  await expect(admin.getByText(/Saldo proveedor|proveedor/i).filter({ visible: true }).first()).toBeVisible();
  const row = admin.locator("tr, li, article, div").filter({ hasText: reference }).filter({ has: admin.getByRole("button", { name: /Aprobar/ }) }).last();
  await row.getByRole("button", { name: /Aprobar/ }).click();
  await admin.getByRole("dialog").getByRole("button", { name: /Sí, acreditar/ }).click();
  await expect(admin.getByText(reference)).toHaveCount(0, { timeout: 15_000 });

  await user.goto("/app");
  await expect(user.getByText("$300").filter({ visible: true }).first()).toBeVisible();
  await userCtx.close();
  await adminCtx.close();
});

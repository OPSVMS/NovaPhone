import { test, expect, type Page } from "@playwright/test";
import { register, fundAccount, buyReadyEsim, dbQuery, emailOf, login, PASSWORD } from "./helpers";

test.describe.configure({ mode: "serial" });

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  return problems;
}
const balanceOf = async (email: string) => (await dbQuery<{ balance_cents: number }>("select balance_cents from users where email = $1", [email]))[0].balance_cents;

test("panel admin: secciones, ficha de usuario y acciones con bitácora", async ({ browser, request }, testInfo) => {
  test.setTimeout(240_000);
  // Cliente con saldo y una eSIM.
  const userCtx = await browser.newContext();
  const user = await userCtx.newPage();
  await register(user, { name: `Cliente Panel ${testInfo.project.name}` });
  const userEmail = emailOf(user);
  await fundAccount(user, request, 300);
  await buyReadyEsim(user, "MX_1_7", /Pagar \$39/);

  // Admin.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const problems = watch(admin);
  await register(admin, { email: `panel-${testInfo.project.name}-${Date.now()}@novaphone.test`, name: "Admin Panel" });
  await dbQuery("update users set role = 'admin' where email = $1", [emailOf(admin)]);

  // Todas las secciones cargan.
  const sections: [string, string][] = [
    ["/admin", "Resumen"],
    ["/admin/usuarios", "Usuarios"],
    ["/admin/esims", "eSIMs"],
    ["/admin/depositos", "Depósitos"],
    ["/admin/numeros", "Números"],
    ["/admin/movimientos", "Movimientos"],
    ["/admin/actividad", "Actividad"],
    ["/admin/sistema", "Sistema"],
  ];
  for (const [url, h1] of sections) {
    await admin.goto(url);
    await expect(admin.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
  }
  await admin.goto("/admin");
  await expect(admin.getByText("Proveedores").first()).toBeVisible();

  // Buscar al usuario y abrir su ficha.
  await admin.goto(`/admin/usuarios?q=${encodeURIComponent(userEmail)}`);
  await admin.getByRole("link", { name: new RegExp(`Cliente Panel ${testInfo.project.name}`) }).filter({ visible: true }).first().click();
  await expect(admin.getByRole("heading", { level: 1, name: `Cliente Panel ${testInfo.project.name}` })).toBeVisible();
  const userUrl = admin.url();

  // Abonar $50.
  const before = await balanceOf(userEmail);
  await admin.getByRole("radio", { name: "Abonar" }).click();
  await admin.getByLabel("Monto").fill("50");
  await admin.getByLabel("Motivo").first().fill("Compensación por prueba");
  await admin.getByRole("button", { name: "Aplicar ajuste" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: /Sí, abonar/ }).click();
  await expect.poll(() => balanceOf(userEmail)).toBe(before + 5000);

  // Cargar $20.
  await admin.getByRole("radio", { name: "Cargar" }).click();
  await admin.getByLabel("Monto").fill("20");
  await admin.getByLabel("Motivo").first().fill("Corrección");
  await admin.getByRole("button", { name: "Aplicar ajuste" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: /Sí, cargar/ }).click();
  await expect.poll(() => balanceOf(userEmail)).toBe(before + 3000);

  // Recarga de cortesía (sin cobrar).
  await admin.getByRole("button", { name: "Recargar" }).first().click();
  const dlg = admin.getByRole("dialog");
  await dlg.getByLabel("Cortesía (no cobrar al usuario)").check();
  await dlg.getByRole("button", { name: "Aplicar recarga" }).click();
  await expect
    .poll(async () => (await dbQuery<{ price_cents: number }>("select t.price_cents from topups t join users u on u.id = t.user_id where u.email = $1 and t.status = 'applied'", [userEmail])).map((t) => t.price_cents))
    .toEqual([0]);
  expect(await balanceOf(userEmail)).toBe(before + 3000);

  // Sincronizar eSIMs con el proveedor.
  await admin.getByRole("button", { name: "Sincronizar todas" }).click();
  await expect(admin.getByText(/actualizadas con el proveedor/)).toBeVisible();

  // Suspender: el usuario pierde la sesión y no puede entrar.
  await admin.getByRole("button", { name: "Suspender cuenta" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Sí, suspender" }).click();
  await expect(admin.getByRole("button", { name: "Reactivar cuenta" })).toBeVisible();
  await user.goto("/app");
  await expect(user).toHaveURL(/\/entrar/);
  await login(user, userEmail);
  await expect(user.getByText(/Tu cuenta está suspendida/)).toBeVisible();

  // Reactivar: puede entrar de nuevo.
  await admin.goto(userUrl);
  await admin.getByRole("button", { name: "Reactivar cuenta" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Sí, reactivar" }).click();
  await expect(admin.getByRole("button", { name: "Suspender cuenta" })).toBeVisible();
  await login(user, userEmail, PASSWORD);
  await user.waitForURL(/\/app/);

  // Hacer y quitar admin.
  await admin.getByRole("button", { name: "Hacer admin" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Sí, hacer admin" }).click();
  await expect.poll(async () => (await dbQuery<{ role: string }>("select role from users where email = $1", [userEmail]))[0].role).toBe("admin");
  await admin.getByRole("button", { name: "Quitar admin" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Sí, quitar admin" }).click();
  await expect.poll(async () => (await dbQuery<{ role: string }>("select role from users where email = $1", [userEmail]))[0].role).toBe("user");

  // Bitácora registra todo.
  const actions = (await dbQuery<{ action: string }>(
    "select a.action from admin_audit a join users u on u.id = a.target_id::uuid where a.target_type = 'user' and u.email = $1",
    [userEmail],
  )).map((a) => a.action);
  for (const a of ["balance.adjust", "user.disable", "user.enable", "user.role"]) expect(actions).toContain(a);
  await admin.reload();
  await expect(admin.getByText(/balance\.adjust|Ajuste|Saldo ajustado/).first()).toBeVisible();

  // Sistema: catálogo y visibilidad de un plan.
  await admin.goto("/admin/sistema");
  await admin.getByRole("button", { name: "Sincronizar catálogo" }).click();
  await expect(admin.getByText(/Catálogo actualizado/)).toBeVisible();

  // Depósitos: conciliar.
  await admin.goto("/admin/depositos");
  await admin.getByRole("button", { name: "Conciliar NOVACORE ahora" }).click();
  await expect(admin.getByText(/Conciliación lista/)).toBeVisible();

  // Un usuario normal no entra al admin.
  await user.goto("/admin");
  await expect(user).toHaveURL(/\/app$/);

  expect(problems, problems.join("\n")).toEqual([]);
  await userCtx.close();
  await adminCtx.close();
});

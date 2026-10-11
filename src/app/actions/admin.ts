"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/admin";
import { adjustBalance } from "@/lib/wallet";
import { formatMxn } from "@/lib/pricing";
import type { FormState } from "./auth";

const ok = (msg: string): FormState => ({ ok: msg });
const fail = (msg: string): FormState => ({ error: msg });
const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

async function targetUser(form: FormData) {
  const id = str(form, "userId");
  return id ? db.query.users.findFirst({ where: eq(schema.users.id, id) }) : undefined;
}

function refresh(userId?: string) {
  revalidatePath("/admin", "layout");
  if (userId) revalidatePath(`/admin/usuarios/${userId}`);
}

/** Ajuste manual de saldo (abono o cargo) con motivo obligatorio. */
export async function adminAdjustBalance(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      amount: z.coerce.number().refine((n) => n !== 0 && Math.abs(n) <= 100_000, "Monto inválido (máx. $100,000)"),
      direction: z.enum(["credit", "debit"]),
      reason: z.string().trim().min(3, "Escribe el motivo"),
    })
    .safeParse({ amount: form.get("amount"), direction: form.get("direction"), reason: form.get("reason") });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  const cents = Math.round(Math.abs(parsed.data.amount) * 100) * (parsed.data.direction === "debit" ? -1 : 1);
  const balance = await adjustBalance({
    userId: user.id,
    amountCents: cents,
    kind: "adjustment",
    description: `Ajuste: ${parsed.data.reason}`,
    refId: admin.id,
  });
  if (balance === null) return fail("El cargo excede el saldo del usuario.");
  await audit(admin.id, "balance.adjust", "user", user.id, { cents, reason: parsed.data.reason, balanceAfter: balance });
  refresh(user.id);
  return ok(`Saldo ajustado ${cents > 0 ? "+" : "−"}${formatMxn(Math.abs(cents))}. Nuevo saldo: ${formatMxn(balance)}.`);
}

/** Suspender / reactivar cuenta. Al suspender se cierran todas sus sesiones. */
export async function adminSetDisabled(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  if (user.id === admin.id) return fail("No puedes suspender tu propia cuenta.");
  const disable = str(form, "disabled") === "1";
  await db.update(schema.users).set({ disabledAt: disable ? new Date() : null }).where(eq(schema.users.id, user.id));
  if (disable) await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await audit(admin.id, disable ? "user.disable" : "user.enable", "user", user.id, { reason: str(form, "reason") || undefined });
  refresh(user.id);
  return ok(disable ? "Cuenta suspendida y sesiones cerradas." : "Cuenta reactivada.");
}

export async function adminSetRole(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  const role = str(form, "role") === "admin" ? "admin" : "user";
  if (user.id === admin.id && role !== "admin") return fail("No puedes quitarte el rol de admin a ti mismo.");
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, user.id));
  await audit(admin.id, "user.role", "user", user.id, { role });
  refresh(user.id);
  return ok(role === "admin" ? "Ahora es administrador." : "Ya no es administrador.");
}

export async function adminSetNote(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  const note = str(form, "note").slice(0, 2000) || null;
  await db.update(schema.users).set({ adminNote: note }).where(eq(schema.users.id, user.id));
  await audit(admin.id, "user.note", "user", user.id);
  refresh(user.id);
  return ok("Nota guardada.");
}

/** Cierra todas las sesiones del usuario (lo obliga a volver a entrar). */
export async function adminLogoutUser(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await audit(admin.id, "user.logout", "user", user.id);
  refresh(user.id);
  return ok("Sesiones cerradas.");
}

/** Marca el correo como verificado (soporte). */
export async function adminVerifyEmail(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  await db.update(schema.users).set({ emailVerifiedAt: user.emailVerifiedAt ?? new Date() }).where(eq(schema.users.id, user.id));
  await audit(admin.id, "user.verify", "user", user.id);
  refresh(user.id);
  return ok("Correo marcado como verificado.");
}

/** NOVACORE: asigna su CLABE si no tiene. */
export async function adminEnsureClabe(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const user = await targetUser(form);
  if (!user) return fail("Usuario no encontrado.");
  const { ensureClabe, novacoreEnabled } = await import("@/lib/novacore");
  if (!novacoreEnabled()) return fail("NOVACORE no está configurado.");
  const clabe = await ensureClabe(user).catch(() => null);
  if (!clabe) return fail("NOVACORE no asignó CLABE. Intenta de nuevo.");
  await audit(admin.id, "user.clabe", "user", user.id, { clabe });
  refresh(user.id);
  return ok(`CLABE: ${clabe}`);
}

/** NOVACORE: concilia depósitos ahora (7 días). */
export async function adminReconcileNow(prev: FormState): Promise<FormState> {
  void prev;
  const admin = await requireAdmin();
  const { reconcileNovacore, novacoreEnabled } = await import("@/lib/novacore");
  if (!novacoreEnabled()) return fail("NOVACORE no está configurado.");
  try {
    const r = await reconcileNovacore(7 * 24 * 60);
    await audit(admin.id, "novacore.reconcile", "system", null, r);
    refresh();
    return ok(`Conciliación lista: ${"seen" in r ? r.seen : 0} revisados, ${"credited" in r ? r.credited : 0} acreditados, ${"returned" in r ? r.returned : 0} devueltos.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Error al conciliar.");
  }
}

/** eSIM Access: consulta consumo/estado de las eSIMs del usuario (o de una). */
export async function adminSyncEsims(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const { refreshOrder } = await import("@/lib/orders");
  const { syncUsage } = await import("@/lib/topups");
  const orderId = str(form, "orderId");
  const userId = str(form, "userId");
  const orders = orderId
    ? await db.query.orders.findMany({ where: eq(schema.orders.id, orderId) })
    : await db.query.orders.findMany({ where: and(eq(schema.orders.userId, userId)) });
  let n = 0;
  for (const o of orders) {
    try {
      const r = o.status === "provisioning" ? await refreshOrder(o) : o;
      if (r.status === "ready") await syncUsage(r);
      n++;
    } catch {}
  }
  await audit(admin.id, "esim.sync", orderId ? "order" : "user", orderId || userId, { count: n });
  refresh(userId || undefined);
  return ok(`${n} eSIM(s) actualizadas con el proveedor.`);
}

async function targetOrder(form: FormData) {
  const id = str(form, "orderId");
  return id ? db.query.orders.findFirst({ where: eq(schema.orders.id, id) }) : undefined;
}

export async function adminCancelEsim(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const order = await targetOrder(form);
  if (!order) return fail("eSIM no encontrada.");
  const { cancelUnused } = await import("@/lib/lifecycle");
  const r = await cancelUnused(order).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : "Error" }));
  if (!r.ok) return fail(r.error);
  await audit(admin.id, "esim.cancel", "order", order.id, { userId: order.userId });
  refresh(order.userId);
  return ok("eSIM cancelada y saldo devuelto al usuario.");
}

export async function adminSuspendEsim(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const order = await targetOrder(form);
  if (!order) return fail("eSIM no encontrada.");
  const suspend = str(form, "suspend") === "1";
  const { setSuspended } = await import("@/lib/lifecycle");
  const r = await setSuspended(order, suspend).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : "Error" }));
  if (!r.ok) return fail(r.error);
  await audit(admin.id, suspend ? "esim.suspend" : "esim.unsuspend", "order", order.id, { userId: order.userId });
  refresh(order.userId);
  return ok(suspend ? "eSIM pausada." : "eSIM reactivada.");
}

/** Recarga desde el admin: cobrada al saldo del usuario o de cortesía. */
export async function adminTopupEsim(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const order = await targetOrder(form);
  if (!order) return fail("eSIM no encontrada.");
  const free = str(form, "free") === "1";
  const { applyTopup } = await import("@/lib/topups");
  const r = await applyTopup(order, str(form, "planId"), { free });
  if (!r.ok) return fail(r.error);
  await audit(admin.id, free ? "esim.topup.free" : "esim.topup", "order", order.id, { userId: order.userId, planId: str(form, "planId") });
  refresh(order.userId);
  return ok(free ? "Recarga de cortesía aplicada." : "Recarga aplicada y cobrada al saldo del usuario.");
}

/** Reenvía el correo con el QR de instalación. */
export async function adminResendEsimEmail(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const order = await targetOrder(form);
  if (!order?.activationCode) return fail("Esta eSIM aún no tiene código de activación.");
  await db.update(schema.orders).set({ emailedAt: null }).where(eq(schema.orders.id, order.id));
  const { refreshOrder } = await import("@/lib/orders");
  await refreshOrder({ ...order, emailedAt: null });
  await audit(admin.id, "esim.resend_email", "order", order.id, { userId: order.userId });
  refresh(order.userId);
  return ok("Correo de instalación reenviado.");
}

/** Catálogo: vuelve a traer planes y tipo de cambio. */
export async function adminSyncCatalog(prev: FormState): Promise<FormState> {
  void prev;
  const admin = await requireAdmin();
  const { syncCatalog } = await import("@/lib/catalog");
  try {
    const r = await syncCatalog();
    await audit(admin.id, "catalog.sync", "system", null, r);
    refresh();
    return ok(`Catálogo actualizado: ${r.plans} planes · tipo de cambio ${r.fx.toFixed(4)}.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo sincronizar.");
  }
}

/** Activa/oculta un plan del catálogo. */
export async function adminTogglePlan(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "planId");
  const active = str(form, "active") === "1";
  await db.update(schema.plans).set({ active }).where(eq(schema.plans.id, id));
  await audit(admin.id, active ? "plan.enable" : "plan.disable", "plan", id);
  refresh();
  return ok(active ? "Plan visible." : "Plan oculto.");
}

/** Telnyx + cloudnumbering: configura la recepción de llamadas con transcripción en todos los números. */
export async function adminSetupVoice(prev: FormState): Promise<FormState> {
  void prev;
  const admin = await requireAdmin();
  const { ensureVoiceRouting, telnyxEnabled } = await import("@/lib/voice");
  if (!telnyxEnabled()) return fail("Telnyx no está configurado.");
  try {
    const r = await ensureVoiceRouting();
    await audit(admin.id, "voice.setup", "system", null, r);
    refresh();
    return ok(`Llamadas configuradas: ${r.routed} número(s) ruteados a ${r.sipUri}.`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudo configurar.");
  }
}

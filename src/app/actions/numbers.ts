"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { getUserOrder } from "@/lib/orders";
import { addInventory, assignNumber, getUserNumber, linkNumberToEsim, releaseNumber, setAutoRenew, storeInboundSms } from "@/lib/numbers";
import type { FormState } from "./auth";

export async function buyNumberAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const orderId = String(form.get("orderId") ?? "") || null;
  if (orderId && !(await getUserOrder(user.id, orderId))) return { error: "Esa eSIM no es tuya." };
  const res = await assignNumber(user, { orderId });
  revalidatePath("/app", "layout");
  return res.ok ? { ok: `Listo, tu número es ${res.number.e164}.` } : { error: res.error };
}

export async function linkEsimAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const orderId = String(form.get("orderId") ?? "") || null;
  if (orderId && !(await getUserOrder(user.id, orderId))) return { error: "Esa eSIM no es tuya." };
  await linkNumberToEsim(user.id, orderId);
  revalidatePath("/app/numero");
  return { ok: orderId ? "Número ligado a tu eSIM." : "Número desligado." };
}

export async function autoRenewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const on = form.get("autoRenew") === "1";
  await setAutoRenew(user.id, on);
  revalidatePath("/app/numero");
  return { ok: on ? "Renovación automática activada." : "Renovación automática desactivada. Conservas el número hasta la fecha de renovación." };
}

/** Admin: agrega números comprados en cloudnumbering al inventario. */
export async function adminAddNumbers(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const added = await addInventory(String(form.get("numbers") ?? ""), String(form.get("country") ?? "GB"), String(form.get("provider") ?? "cloudnumbering"));
  revalidatePath("/admin/numeros");
  return added ? { ok: `${added} número(s) agregados al inventario.` } : { error: "No se agregó ningún número (¿formato o ya existían?)." };
}

/** Admin: asigna un número a un usuario sin cobrar (pruebas, cortesías). */
export async function adminAssignNumber(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user) return { error: "No existe un usuario con ese correo." };
  const e164 = String(form.get("e164") ?? "") || undefined;
  const orderId = String(form.get("orderId") ?? "") || null;
  const res = await assignNumber(user, { charge: false, e164, orderId });
  revalidatePath("/admin/numeros");
  return res.ok ? { ok: `${res.number.e164} asignado a ${email}.` } : { error: res.error };
}

export async function adminReleaseNumber(form: FormData) {
  await requireAdmin();
  await releaseNumber(String(form.get("numberId") ?? ""));
  revalidatePath("/admin/numeros");
}

/** Admin: simula un SMS entrante (para probar la bandeja sin el proveedor). */
export async function adminTestSms(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await storeInboundSms({ to: String(form.get("to") ?? ""), from: String(form.get("from") ?? "NovaPhone"), body: String(form.get("body") ?? "") });
  revalidatePath("/admin/numeros");
  return res.result === "stored" ? { ok: "SMS de prueba entregado." } : { error: "Ese número no está en el inventario." };
}

export async function getMyNumber() {
  const user = await requireUser();
  return getUserNumber(user.id);
}

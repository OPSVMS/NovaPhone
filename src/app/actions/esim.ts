"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { getUserOrder } from "@/lib/orders";
import { applyTopup, setAutoTopup, getTopupOptions } from "@/lib/topups";
import type { FormState } from "./auth";

export async function topupAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const order = await getUserOrder(user.id, String(form.get("orderId") ?? ""));
  if (!order) return { error: "No encontramos esa eSIM." };
  const result = await applyTopup(order, String(form.get("planId") ?? ""));
  revalidatePath("/app", "layout");
  return result.ok ? { ok: "Recarga aplicada. Tus datos y días ya se sumaron." } : { error: result.error };
}

export async function autoTopupAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const orderId = String(form.get("orderId") ?? "");
  const planId = String(form.get("planId") ?? "") || null;
  const order = await getUserOrder(user.id, orderId);
  if (!order) return { error: "No encontramos esa eSIM." };
  if (planId && !(await getTopupOptions(order)).some((o) => o.planId === planId)) return { error: "Esa recarga no está disponible." };
  await setAutoTopup(user.id, orderId, planId);
  revalidatePath(`/app/esims/${orderId}`);
  return { ok: planId ? "Auto-recarga activada." : "Auto-recarga desactivada." };
}

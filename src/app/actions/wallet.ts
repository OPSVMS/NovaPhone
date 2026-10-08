"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, requireAdmin } from "@/lib/session";
import { createDeposit, completeDeposit, MIN_DEPOSIT_MXN, MAX_DEPOSIT_MXN } from "@/lib/deposits";
import { purchasePlan } from "@/lib/orders";
import { getUsdMxn } from "@/lib/fx";
import type { FormState } from "./auth";

const depositSchema = z.object({
  method: z.enum(["spei", "usdt"]),
  amount: z.coerce.number().int("Usa montos enteros").min(MIN_DEPOSIT_MXN, `Mínimo $${MIN_DEPOSIT_MXN}`).max(MAX_DEPOSIT_MXN, `Máximo $${MAX_DEPOSIT_MXN.toLocaleString("es-MX")}`),
});

export async function requestDeposit(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = depositSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const dep = await createDeposit(user.id, parsed.data.method, parsed.data.amount, await getUsdMxn());
  redirect(`/app/fondos/${dep.id}`);
}

export async function buyPlan(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const planId = String(form.get("planId") ?? "");
  const result = await purchasePlan(user, planId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/app", "layout");
  redirect(`/app/esims/${result.orderId}`);
}

/** Admin: acreditar manualmente un depósito pendiente (mientras se conecta el core bancario). */
export async function adminApproveDeposit(form: FormData) {
  await requireAdmin();
  const id = String(form.get("depositId") ?? "");
  await completeDeposit(id, { meta: { approvedManually: true } });
  revalidatePath("/admin");
}

export async function adminCancelDeposit(form: FormData) {
  await requireAdmin();
  const id = String(form.get("depositId") ?? "");
  // Solo depósitos pendientes: nunca marcar como cancelado uno ya acreditado.
  await db
    .update(schema.deposits)
    .set({ status: "cancelled" })
    .where(and(eq(schema.deposits.id, id), eq(schema.deposits.status, "pending")));
  revalidatePath("/admin");
}

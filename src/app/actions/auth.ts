"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, desc, sql } from "drizzle-orm";
import { createHash, randomInt } from "node:crypto";
import { db, schema } from "@/db";
import { createSession, destroySession, getUser } from "@/lib/session";
import { emailEnabled, sendVerificationCode } from "@/lib/email";

export type FormState = { error?: string; ok?: string } | undefined;

const hashCode = (c: string) => createHash("sha256").update(c).digest("hex");
/** Solo rutas internas ("/app/..."), nunca "//host" ni URLs absolutas. */
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null);
const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

async function issueCode(userId: string, email: string) {
  const code = String(randomInt(100000, 999999));
  await db.insert(schema.emailCodes).values({ userId, purpose: "verify", codeHash: hashCode(code), expiresAt: new Date(Date.now() + 15 * 60_000) });
  await sendVerificationCode(email, code);
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.email("Correo inválido").transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const next = safeNext(form.get("next"));

  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (exists) return { error: "Ya existe una cuenta con ese correo." };

  const [user] = await db
    .insert(schema.users)
    .values({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: adminEmails().includes(email) ? "admin" : "user",
      // Sin proveedor de correo configurado, la cuenta queda verificada automáticamente.
      emailVerifiedAt: emailEnabled() ? null : new Date(),
    })
    .returning();

  await createSession(user.id);
  if (!emailEnabled()) redirect(next ?? "/app");
  await issueCode(user.id, email);
  redirect(next ? `/verificar?next=${encodeURIComponent(next)}` : "/verificar");
}

const loginSchema = z.object({
  email: z.string().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisa tus datos." };
  const { email, password, next } = parsed.data;
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Correo o contraseña incorrectos." };
  await createSession(user.id);
  redirect(safeNext(next) ?? "/app");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function verifyEmail(_: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  const next = safeNext(form.get("next")) ?? "/app";
  if (!user) redirect("/entrar");
  if (user.verified) redirect(next);
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "El código tiene 6 dígitos." };

  const row = await db.query.emailCodes.findFirst({
    where: and(eq(schema.emailCodes.userId, user.id), eq(schema.emailCodes.purpose, "verify"), isNull(schema.emailCodes.usedAt), gt(schema.emailCodes.expiresAt, new Date())),
    orderBy: desc(schema.emailCodes.createdAt),
  });
  if (!row || row.attempts >= 5) return { error: "El código expiró. Pide uno nuevo." };
  if (row.codeHash !== hashCode(code)) {
    await db.update(schema.emailCodes).set({ attempts: sql`${schema.emailCodes.attempts} + 1` }).where(eq(schema.emailCodes.id, row.id));
    return { error: "Código incorrecto." };
  }
  await db.update(schema.emailCodes).set({ usedAt: new Date() }).where(eq(schema.emailCodes.id, row.id));
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, user.id));
  redirect(next);
}

export async function resendCode(): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const recent = await db.query.emailCodes.findFirst({
    where: and(eq(schema.emailCodes.userId, user.id), gt(schema.emailCodes.createdAt, new Date(Date.now() - 60_000))),
  });
  if (recent) return { error: "Espera un minuto antes de pedir otro código." };
  await issueCode(user.id, user.email);
  return { ok: "Te enviamos un código nuevo." };
}

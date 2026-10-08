import { pgTable, text, integer, timestamp, uuid, numeric, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"user" | "admin">().notNull().default("user"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Saldo en centavos MXN. */
  balanceCents: integer("balance_cents").notNull().default(0),
  /** CLABE personal asignada por el core bancario (depósitos SPEI sin referencia). */
  clabe: text("clabe"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_clabe_idx").on(t.clabe)]);

export const sessions = pgTable("sessions", {
  /** sha256 del token de la cookie. */
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailCodes = pgTable("email_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").$type<"verify" | "reset">().notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  /** slug del proveedor, ej. MX_20_30 */
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("esimaccess"),
  providerCode: text("provider_code").notNull(),
  name: text("name").notNull(),
  countryCode: text("country_code").notNull(),
  dataGb: numeric("data_gb", { mode: "number" }).notNull(),
  days: integer("days").notNull(),
  daily: boolean("daily").notNull().default(false),
  costUsd: numeric("cost_usd", { mode: "number" }).notNull(),
  /** Precio público en pesos cerrados. */
  priceMxn: integer("price_mxn").notNull(),
  networks: text("networks").notNull().default(""),
  speed: text("speed").notNull().default(""),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deposits = pgTable("deposits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  method: text("method").$type<"spei" | "usdt" | "manual">().notNull(),
  amountCents: integer("amount_cents").notNull(),
  /** Para USDT: monto exacto esperado (con decimales únicos). */
  expectedUsdt: numeric("expected_usdt", { mode: "string" }),
  reference: text("reference").notNull(),
  status: text("status").$type<"pending" | "completed" | "expired" | "cancelled">().notNull().default("pending"),
  externalId: text("external_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("deposits_reference_idx").on(t.reference), uniqueIndex("deposits_external_idx").on(t.externalId), index("deposits_user_idx").on(t.userId)]);

export const ledger = pgTable("ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  kind: text("kind").$type<"deposit" | "purchase" | "refund" | "adjustment">().notNull(),
  refId: text("ref_id"),
  description: text("description").notNull(),
  balanceAfterCents: integer("balance_after_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ledger_user_idx").on(t.userId)]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  planId: text("plan_id").notNull().references(() => plans.id),
  planName: text("plan_name").notNull(),
  priceCents: integer("price_cents").notNull(),
  costUsd: numeric("cost_usd", { mode: "number" }).notNull(),
  status: text("status").$type<"provisioning" | "ready" | "failed" | "refunded" | "cancelled">().notNull().default("provisioning"),
  providerOrderNo: text("provider_order_no"),
  esimTranNo: text("esim_tran_no"),
  iccid: text("iccid"),
  activationCode: text("activation_code"),
  apn: text("apn"),
  esimStatus: text("esim_status"),
  /** Estado del perfil en el teléfono: RELEASED, DOWNLOAD, INSTALLATION, ENABLED, DISABLED, DELETED. */
  smdpStatus: text("smdp_status"),
  suspended: boolean("suspended").notNull().default(false),
  usedBytes: numeric("used_bytes", { mode: "number" }),
  totalBytes: numeric("total_bytes", { mode: "number" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  usageSyncedAt: timestamp("usage_synced_at", { withTimezone: true }),
  /** Auto-recarga: plan a aplicar cuando quedan pocos datos o días. */
  autoTopupPlanId: text("auto_topup_plan_id"),
  autoTopupLastAt: timestamp("auto_topup_last_at", { withTimezone: true }),
  lowBalanceNotifiedAt: timestamp("low_balance_notified_at", { withTimezone: true }),
  lowDataNotifiedAt: timestamp("low_data_notified_at", { withTimezone: true }),
  expiryNotifiedAt: timestamp("expiry_notified_at", { withTimezone: true }),
  error: text("error"),
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("orders_user_idx").on(t.userId), index("orders_provider_idx").on(t.providerOrderNo)]);

export const topups = pgTable("topups", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  planId: text("plan_id").notNull(),
  planName: text("plan_name").notNull(),
  priceCents: integer("price_cents").notNull(),
  costUsd: numeric("cost_usd", { mode: "number" }).notNull(),
  auto: boolean("auto").notNull().default(false),
  status: text("status").$type<"pending" | "applied" | "refunded">().notNull().default("pending"),
  providerTxn: text("provider_txn"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("topups_order_idx").on(t.orderId)]);

/** Eventos de webhooks ya procesados (deduplicación por notifyId). */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type Topup = typeof topups.$inferSelect;

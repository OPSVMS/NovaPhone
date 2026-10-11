import "server-only";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql as dsql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { getBalanceUsd } from "./esimaccess";
import { cloudnumberingEnabled, getCloudnumberingBalance } from "./cloudnumbering";
import { novacoreEnabled } from "./novacore";
import { openpayEnabled } from "./openpay";
import { emailEnabled } from "./email";
import { getFxUsdMxn } from "./queries";

const DAY = 86_400_000;
/** Referencia calificada a users.id para subconsultas correlacionadas (drizzle la emite sin tabla). */
const UID = dsql.raw(`"users"."id"`);
const since = (days: number) => new Date(Date.now() - days * DAY);
const int = (v: unknown) => Number(v ?? 0);

/** Registra una acción de administrador. */
export async function audit(adminId: string, action: string, targetType: string, targetId: string | null, details?: Record<string, unknown>) {
  await db.insert(schema.adminAudit).values({ adminId, action, targetType, targetId, details: details ?? null });
}

/** KPIs del resumen. Montos en centavos MXN. */
export async function getOverview() {
  const [users, esims, numbers, money, deposits, liability, fx] = await Promise.all([
    db.execute(dsql`select
      count(*)::int total,
      count(*) filter (where created_at > ${since(7)})::int new7,
      count(*) filter (where last_seen_at > ${since(7)})::int active7,
      count(*) filter (where last_seen_at > ${since(1)})::int active1,
      count(*) filter (where clabe is not null)::int with_clabe,
      count(*) filter (where disabled_at is not null)::int disabled
      from users`),
    db.execute(dsql`select
      count(*)::int total,
      count(*) filter (where status = 'ready' and (expires_at is null or expires_at > now()) and coalesce(esim_status,'') not in ('CANCEL','USED_EXPIRED','UNUSED_EXPIRED','REVOKED'))::int active,
      count(*) filter (where smdp_status = 'ENABLED')::int installed,
      count(*) filter (where status = 'provisioning')::int provisioning,
      count(*) filter (where created_at > ${since(30)})::int sold30,
      coalesce(sum(cost_usd) filter (where status = 'ready'),0)::float cost_usd
      from orders`),
    db.execute(dsql`select
      count(*) filter (where status = 'assigned')::int assigned,
      count(*) filter (where status = 'available')::int available,
      count(*) filter (where status = 'assigned' and grace_until is not null)::int grace
      from phone_numbers`),
    db.execute(dsql`select
      coalesce(-sum(amount_cents) filter (where kind = 'purchase'),0)::bigint sales_all,
      coalesce(-sum(amount_cents) filter (where kind = 'purchase' and created_at > ${since(1)}),0)::bigint sales1,
      coalesce(-sum(amount_cents) filter (where kind = 'purchase' and created_at > ${since(7)}),0)::bigint sales7,
      coalesce(-sum(amount_cents) filter (where kind = 'purchase' and created_at > ${since(30)}),0)::bigint sales30,
      coalesce(sum(amount_cents) filter (where kind = 'refund'),0)::bigint refunds
      from ledger`),
    db.execute(dsql`select method, count(*)::int n, coalesce(sum(amount_cents),0)::bigint cents
      from deposits where status = 'completed' and completed_at > ${since(30)} group by method`),
    db.execute(dsql`select coalesce(sum(balance_cents),0)::bigint cents from users`),
    getFxUsdMxn(),
  ]);
  const [esimAccessUsd, cloudnumbering] = await Promise.all([
    getBalanceUsd().catch(() => null),
    cloudnumberingEnabled() ? getCloudnumberingBalance().catch(() => null) : Promise.resolve(null),
  ]);
  const m = money.rows[0] as Record<string, unknown>;
  const e = esims.rows[0] as Record<string, unknown>;
  const salesAll = int(m.sales_all);
  const costCents = Math.round(int(e.cost_usd) * fx * 100);
  return {
    users: users.rows[0] as { total: number; new7: number; active7: number; active1: number; with_clabe: number; disabled: number },
    esims: { total: int(e.total), active: int(e.active), installed: int(e.installed), provisioning: int(e.provisioning), sold30: int(e.sold30) },
    numbers: numbers.rows[0] as { assigned: number; available: number; grace: number },
    sales: { today: int(m.sales1), week: int(m.sales7), month: int(m.sales30), all: salesAll, refunds: int(m.refunds) },
    /** Margen aproximado de eSIMs: ventas totales menos costo de eSIMs (no incluye recargas ni números). */
    estimatedMarginCents: salesAll - costCents,
    deposits30: (deposits.rows as { method: string; n: number; cents: unknown }[]).map((d) => ({ method: d.method, n: int(d.n), cents: int(d.cents) })),
    /** Saldo que la plataforma le debe a sus usuarios (pasivo). */
    usersBalanceCents: int((liability.rows[0] as Record<string, unknown>).cents),
    fx,
    providers: {
      esimAccessUsd,
      cloudnumbering,
      novacore: novacoreEnabled(),
      openpay: openpayEnabled(),
      email: emailEnabled(),
    },
  };
}

export type UserFilter = "all" | "active" | "with-balance" | "with-esim" | "with-number" | "disabled" | "admins" | "unverified";

/** Lista de usuarios con agregados. */
export async function listUsers({ q = "", filter = "all", limit = 100, offset = 0 }: { q?: string; filter?: UserFilter; limit?: number; offset?: number }) {
  const conds: SQL[] = [];
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(schema.users.email, like), ilike(schema.users.name, like), ilike(schema.users.clabe, like))!);
  }
  if (filter === "active") conds.push(gte(schema.users.lastSeenAt, since(7)));
  if (filter === "with-balance") conds.push(dsql`${schema.users.balanceCents} > 0`);
  if (filter === "disabled") conds.push(isNotNull(schema.users.disabledAt));
  if (filter === "admins") conds.push(eq(schema.users.role, "admin"));
  if (filter === "unverified") conds.push(isNull(schema.users.emailVerifiedAt));
  if (filter === "with-esim") conds.push(dsql`exists (select 1 from orders o where o.user_id = ${UID} and o.status = 'ready')`);
  if (filter === "with-number") conds.push(dsql`exists (select 1 from phone_numbers p where p.user_id = ${UID} and p.status = 'assigned')`);
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      verified: dsql<boolean>`${schema.users.emailVerifiedAt} is not null`,
      disabled: dsql<boolean>`${schema.users.disabledAt} is not null`,
      balanceCents: schema.users.balanceCents,
      clabe: schema.users.clabe,
      createdAt: schema.users.createdAt,
      lastSeenAt: schema.users.lastSeenAt,
      esims: dsql<number>`(select count(*)::int from orders o where o.user_id = ${UID} and o.status = 'ready')`,
      activeEsims: dsql<number>`(select count(*)::int from orders o where o.user_id = ${UID} and o.status = 'ready' and (o.expires_at is null or o.expires_at > now()) and coalesce(o.esim_status,'') not in ('CANCEL','USED_EXPIRED','UNUSED_EXPIRED','REVOKED'))`,
      number: dsql<string | null>`(select p.e164 from phone_numbers p where p.user_id = ${UID} and p.status = 'assigned' limit 1)`,
      depositedCents: dsql<number>`(select coalesce(sum(d.amount_cents),0)::int from deposits d where d.user_id = ${UID} and d.status = 'completed')`,
      spentCents: dsql<number>`(select coalesce(-sum(l.amount_cents),0)::int from ledger l where l.user_id = ${UID} and l.kind = 'purchase')`,
    })
    .from(schema.users)
    .where(where)
    .orderBy(desc(dsql`coalesce(${schema.users.lastSeenAt}, ${schema.users.createdAt})`))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db.select({ total: dsql<number>`count(*)::int` }).from(schema.users).where(where);
  return { rows, total };
}

/** Todo lo de un usuario para su ficha. */
export async function getUserDetail(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return null;
  const [ledger, deposits, orders, topups, number, sessions, auditRows] = await Promise.all([
    db.query.ledger.findMany({ where: eq(schema.ledger.userId, userId), orderBy: desc(schema.ledger.createdAt), limit: 100 }),
    db.query.deposits.findMany({ where: eq(schema.deposits.userId, userId), orderBy: desc(schema.deposits.createdAt), limit: 50 }),
    db.query.orders.findMany({ where: eq(schema.orders.userId, userId), orderBy: desc(schema.orders.createdAt) }),
    db.query.topups.findMany({ where: eq(schema.topups.userId, userId), orderBy: desc(schema.topups.createdAt), limit: 50 }),
    db.query.phoneNumbers.findFirst({ where: and(eq(schema.phoneNumbers.userId, userId), eq(schema.phoneNumbers.status, "assigned")) }),
    db.select({ n: dsql<number>`count(*)::int`, last: dsql<Date | null>`max(created_at)` }).from(schema.sessions).where(and(eq(schema.sessions.userId, userId), gte(schema.sessions.expiresAt, new Date()))),
    db
      .select({ a: schema.adminAudit, adminEmail: schema.users.email })
      .from(schema.adminAudit)
      .innerJoin(schema.users, eq(schema.users.id, schema.adminAudit.adminId))
      .where(and(eq(schema.adminAudit.targetType, "user"), eq(schema.adminAudit.targetId, userId)))
      .orderBy(desc(schema.adminAudit.createdAt))
      .limit(50),
  ]);
  const [sms, calls] = number
    ? await Promise.all([
        db.query.smsMessages.findMany({ where: eq(schema.smsMessages.numberId, number.id), orderBy: desc(schema.smsMessages.receivedAt), limit: 50 }),
        db.query.callLogs.findMany({ where: eq(schema.callLogs.numberId, number.id), orderBy: desc(schema.callLogs.startedAt), limit: 50 }),
      ])
    : [[], []];
  const { passwordHash: _omit, ...safeUser } = user;
  void _omit;
  return {
    user: safeUser,
    ledger,
    deposits,
    orders,
    topups,
    number: number ?? null,
    sms,
    calls,
    sessions: { active: sessions[0]?.n ?? 0, lastLogin: sessions[0]?.last ?? null },
    audit: auditRows.map((r) => ({ ...r.a, adminEmail: r.adminEmail })),
  };
}

/** eSIMs de todos los usuarios. */
export async function listOrders({ status, q = "", limit = 100 }: { status?: string; q?: string; limit?: number }) {
  const conds: SQL[] = [];
  if (status === "active") conds.push(dsql`${schema.orders.status} = 'ready' and (${schema.orders.expiresAt} is null or ${schema.orders.expiresAt} > now())`);
  else if (status === "expired") conds.push(dsql`${schema.orders.status} = 'ready' and ${schema.orders.expiresAt} < now()`);
  else if (status && status !== "all") conds.push(eq(schema.orders.status, status as "ready"));
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(schema.users.email, like), ilike(schema.orders.iccid, like), ilike(schema.orders.planName, like), ilike(schema.orders.providerOrderNo, like))!);
  }
  return db
    .select({ order: schema.orders, email: schema.users.email, name: schema.users.name })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);
}

/** Depósitos de todos los usuarios. */
export async function listDeposits({ method, status, q = "", limit = 100 }: { method?: string; status?: string; q?: string; limit?: number }) {
  const conds: SQL[] = [];
  if (method && method !== "all") conds.push(eq(schema.deposits.method, method as "spei"));
  if (status && status !== "all") conds.push(eq(schema.deposits.status, status as "completed"));
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(schema.users.email, like), ilike(schema.deposits.reference, like), ilike(schema.deposits.externalId, like))!);
  }
  return db
    .select({ deposit: schema.deposits, email: schema.users.email, name: schema.users.name })
    .from(schema.deposits)
    .innerJoin(schema.users, eq(schema.users.id, schema.deposits.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.deposits.createdAt))
    .limit(limit);
}

/** Movimientos de saldo de todos los usuarios. */
export async function listLedger({ kind, limit = 200 }: { kind?: string; limit?: number }) {
  return db
    .select({ entry: schema.ledger, email: schema.users.email })
    .from(schema.ledger)
    .innerJoin(schema.users, eq(schema.users.id, schema.ledger.userId))
    .where(kind && kind !== "all" ? eq(schema.ledger.kind, kind as "purchase") : undefined)
    .orderBy(desc(schema.ledger.createdAt))
    .limit(limit);
}

export type ActivityItem = { at: Date; type: string; title: string; detail: string; userId: string | null; email: string | null; amountCents?: number };

/** Actividad reciente de la plataforma (registros, depósitos, compras, recargas, números, SMS). */
export async function getActivity(limit = 60): Promise<ActivityItem[]> {
  const res = await db.execute(dsql`
    (select u.created_at at, 'signup' type, 'Nuevo registro' title, u.name detail, u.id user_id, u.email, null::int amount from users u order by u.created_at desc limit ${limit})
    union all
    (select d.completed_at, 'deposit', 'Depósito ' || upper(d.method), coalesce(d.meta->>'payerName',''), u.id, u.email, d.amount_cents from deposits d join users u on u.id = d.user_id where d.status = 'completed' order by d.completed_at desc limit ${limit})
    union all
    (select o.created_at, 'esim', 'Compra de eSIM', o.plan_name || ' · ' || o.status, u.id, u.email, o.price_cents from orders o join users u on u.id = o.user_id order by o.created_at desc limit ${limit})
    union all
    (select t.created_at, 'topup', case when t.auto then 'Auto-recarga' else 'Recarga' end, t.plan_name || ' · ' || t.status, u.id, u.email, t.price_cents from topups t join users u on u.id = t.user_id order by t.created_at desc limit ${limit})
    union all
    (select p.assigned_at, 'number', 'Número asignado', p.e164, u.id, u.email, p.monthly_price_cents from phone_numbers p join users u on u.id = p.user_id where p.assigned_at is not null order by p.assigned_at desc limit ${limit})
    union all
    (select s.received_at, 'sms', 'SMS recibido', s.from_number || ' → ' || s.to_number, u.id, u.email, null from sms_messages s left join users u on u.id = s.user_id order by s.received_at desc limit ${limit})
    order by 1 desc limit ${limit}`);
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    at: new Date(r.at as string),
    type: r.type as string,
    title: r.title as string,
    detail: (r.detail as string) ?? "",
    userId: (r.user_id as string) ?? null,
    email: (r.email as string) ?? null,
    amountCents: r.amount === null || r.amount === undefined ? undefined : int(r.amount),
  }));
}

export async function getAuditLog(limit = 100) {
  const rows = await db
    .select({ a: schema.adminAudit, adminEmail: schema.users.email })
    .from(schema.adminAudit)
    .innerJoin(schema.users, eq(schema.users.id, schema.adminAudit.adminId))
    .orderBy(desc(schema.adminAudit.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.a, adminEmail: r.adminEmail }));
}

/** Estado de crons/sincronizaciones según la última actividad registrada. */
export async function getSystemStatus() {
  const [fxRow, lastSync, lastWebhook, stuck] = await Promise.all([
    db.query.settings.findFirst({ where: eq(schema.settings.key, "fx_usd_mxn") }),
    db.select({ at: dsql<Date | null>`max(usage_synced_at)` }).from(schema.orders),
    db.select({ at: dsql<Date | null>`max(created_at)` }).from(schema.webhookEvents),
    db.query.orders.findMany({ where: and(eq(schema.orders.status, "provisioning"), lt(schema.orders.createdAt, new Date(Date.now() - 10 * 60_000))) }),
  ]);
  return {
    fx: fxRow ? { value: Number(fxRow.value), updatedAt: fxRow.updatedAt } : null,
    lastUsageSync: lastSync[0]?.at ?? null,
    lastProviderWebhook: lastWebhook[0]?.at ?? null,
    stuckOrders: stuck,
  };
}

export { inArray };

import type { Metadata } from "next";
import { CircleCheck, Hourglass, MessageSquareText, UserRound } from "lucide-react";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/session";
import { availableCount, listInventory, recentSms } from "@/lib/numbers";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { InventoryStatusBadge } from "@/components/app/status-badges";
import { AddNumbersForm, AssignNumberForm, CloudnumberingPanel, ReleaseNumberButton, TestSmsForm } from "@/components/app/admin-numbers";
import { cloudnumberingEnabled, getCloudnumberingBalance } from "@/lib/cloudnumbering";
import { formatDate, formatDateTime, formatPhone } from "@/components/app/format";

export const metadata: Metadata = { title: "Números · Admin" };

const th = "px-5 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-subtle";
const td = "px-5 py-3.5 text-sm";

async function counts() {
  const now = new Date();
  const p = schema.phoneNumbers;
  const [row] = await db
    .select({
      assigned: sql<number>`count(*) filter (where ${p.status} = 'assigned')::int`,
      grace: sql<number>`count(*) filter (where ${p.status} = 'assigned' and ${p.graceUntil} is not null)::int`,
      cooldown: sql<number>`count(*) filter (where ${p.status} = 'cooldown' and ${p.cooldownUntil} > ${now.toISOString()}::timestamptz)::int`,
    })
    .from(p);
  return { assigned: row?.assigned ?? 0, cooldown: row?.cooldown ?? 0, grace: row?.grace ?? 0 };
}

export default async function AdminNumbersPage() {
  await requireAdmin();
  const cnEnabled = cloudnumberingEnabled();
  const [inventory, sms, available, stats, cnBalance] = await Promise.all([
    listInventory(),
    recentSms(30),
    availableCount(),
    counts(),
    cnEnabled ? getCloudnumberingBalance().catch(() => null) : Promise.resolve(null),
  ]);

  const userIds = [...new Set(inventory.map((n) => n.userId).filter((v): v is string => !!v))];
  const users = userIds.length
    ? await db.query.users.findMany({ where: inArray(schema.users.id, userIds), columns: { id: true, email: true } })
    : [];
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  const allNumbers = inventory.map((n) => n.e164);
  const freeNumbers = inventory
    .filter((n) => n.status === "available" || (n.status === "cooldown" && n.cooldownUntil && n.cooldownUntil < new Date()))
    .map((n) => n.e164);

  const tiles = [
    { label: "Disponibles", icon: <CircleCheck aria-hidden />, value: available, hint: available === 0 ? "Agrega inventario" : "Listos para vender", warn: available === 0 },
    { label: "Asignados", icon: <UserRound aria-hidden />, value: stats.assigned, hint: stats.grace ? `${stats.grace} en periodo de gracia` : "Al corriente", warn: stats.grace > 0 },
    { label: "En espera", icon: <Hourglass aria-hidden />, value: stats.cooldown, hint: "Cooldown de 90 días" },
  ];

  return (
    <div className="flex flex-col gap-10 pb-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">Números</h1>
        <p className="text-[15px] text-muted">Inventario de números virtuales, asignaciones y SMS.</p>
      </div>

      <Stagger immediate className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <StaggerItem key={t.label} className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}>
            <Card className="h-full p-4 sm:p-5">
              <Stat
                label={t.label}
                icon={t.icon}
                value={t.value.toLocaleString("es-MX")}
                hint={t.warn ? <span className="text-warning">{t.hint}</span> : t.hint}
              />
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <CloudnumberingPanel balance={cnBalance} enabled={cnEnabled} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AddNumbersForm />
        <AssignNumberForm numbers={freeNumbers} />
      </div>

      {/* Inventory */}
      <section aria-labelledby="inventory" className="flex flex-col gap-3">
        <h2 id="inventory" className="text-lg font-semibold text-fg">
          Inventario <span className="text-sm font-normal text-subtle tabular-nums">({inventory.length})</span>
        </h2>
        {inventory.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">
            Aún no hay números. Agrégalos arriba.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className={th}>Número</th>
                    <th className={th}>Estado</th>
                    <th className={th}>Usuario</th>
                    <th className={th}>Renueva</th>
                    <th className={th}>En espera hasta</th>
                    <th className={`${th} text-right`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventory.map((n) => {
                    const email = n.userId ? (emailOf.get(n.userId) ?? null) : null;
                    return (
                      <tr key={n.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className={`${td} whitespace-nowrap`}>
                          <p className="font-mono text-fg tabular-nums">{formatPhone(n.e164)}</p>
                          <p className="text-[12px] text-subtle">
                            {n.country} · {n.provider}
                          </p>
                        </td>
                        <td className={td}>
                          <InventoryStatusBadge status={n.status} cooldownUntil={n.cooldownUntil} />
                        </td>
                        <td className={`${td} max-w-56 truncate text-muted`}>{email ?? "—"}</td>
                        <td className={`${td} whitespace-nowrap text-muted`}>
                          {n.renewsAt ? formatDate(n.renewsAt) : "—"}
                          {n.graceUntil ? <p className="text-[12px] text-warning">Gracia: {formatDate(n.graceUntil)}</p> : null}
                          {n.status === "assigned" && !n.autoRenew ? <p className="text-[12px] text-subtle">Sin auto-renovar</p> : null}
                        </td>
                        <td className={`${td} whitespace-nowrap text-muted`}>{n.cooldownUntil ? formatDate(n.cooldownUntil) : "—"}</td>
                        <td className={`${td} text-right`}>
                          {n.status === "assigned" ? (
                            <div className="flex justify-end">
                              <ReleaseNumberButton numberId={n.id} e164={n.e164} email={email} />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {inventory.map((n) => {
                const email = n.userId ? (emailOf.get(n.userId) ?? null) : null;
                return (
                  <li key={n.id} className="flex flex-col gap-2.5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-fg tabular-nums">{formatPhone(n.e164)}</p>
                        <p className="truncate text-[13px] text-subtle">{email ?? `${n.country} · ${n.provider}`}</p>
                      </div>
                      <InventoryStatusBadge status={n.status} cooldownUntil={n.cooldownUntil} />
                    </div>
                    {n.renewsAt || n.cooldownUntil ? (
                      <p className="text-[13px] text-muted">
                        {n.renewsAt ? `Renueva ${formatDate(n.renewsAt)}` : ""}
                        {n.graceUntil ? ` · Gracia hasta ${formatDate(n.graceUntil)}` : ""}
                        {n.cooldownUntil && n.status === "cooldown" ? `En espera hasta ${formatDate(n.cooldownUntil)}` : ""}
                      </p>
                    ) : null}
                    {n.status === "assigned" ? <ReleaseNumberButton numberId={n.id} e164={n.e164} email={email} /> : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        {/* Recent SMS */}
        <section aria-labelledby="sms" className="flex min-w-0 flex-col gap-3">
          <h2 id="sms" className="text-lg font-semibold text-fg">
            SMS recientes
          </h2>
          <Card className="overflow-hidden">
            {sms.length === 0 ? (
              <p className="flex flex-col items-center gap-2 px-5 py-8 text-center text-sm text-muted">
                <MessageSquareText aria-hidden className="size-5 text-subtle" />
                Sin mensajes todavía.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sms.map((m) => (
                  <li key={m.id} className="flex flex-col gap-1 px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-muted">
                        <span className="text-fg">{m.fromNumber}</span> → <span className="font-mono">{formatPhone(m.toNumber)}</span>
                      </span>
                      <span className="shrink-0 text-subtle">{formatDateTime(m.receivedAt)}</span>
                    </div>
                    <p className="line-clamp-2 break-words text-sm text-muted">{m.body}</p>
                    {!m.userId ? <p className="text-[12px] text-warning">Sin usuario asignado</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <TestSmsForm numbers={allNumbers} />
      </div>
    </div>
  );
}

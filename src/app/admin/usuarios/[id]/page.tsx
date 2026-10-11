import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import {
  CardSim,
  ChevronLeft,
  KeyRound,
  Landmark,
  LogOut,
  MailCheck,
  Mail,
  Pause,
  Phone,
  PhoneIncoming,
  Play,
  RefreshCw,
  Shield,
  ShieldOff,
  StickyNote,
  UserCheck,
  UserX,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import type { Order } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { getUserDetail } from "@/lib/admin";
import { UUID_RE } from "@/lib/queries";
import { getTopupOptions, type TopupOption } from "@/lib/topups";
import { formatGb, formatMxn } from "@/lib/pricing";
import {
  adminAdjustBalance,
  adminCancelEsim,
  adminEnsureClabe,
  adminLogoutUser,
  adminResendEsimEmail,
  adminSetDisabled,
  adminSetNote,
  adminSetRole,
  adminSuspendEsim,
  adminSyncEsims,
  adminTopupEsim,
  adminVerifyEmail,
} from "@/app/actions/admin";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Select } from "@/components/ui/input";
import { UsageBar } from "@/components/app/usage-bar";
import { LedgerRow } from "@/components/app/ledger-row";
import { AuditList } from "@/components/app/admin-activity";
import { ActionButton, ActionGroup, AdjustBalanceForm, ConfirmAction, NoteForm, ReasonField } from "@/components/app/admin-actions";
import { Detail, SectionTitle, money, td, th } from "@/components/app/admin-ui";
import {
  DepositStatusBadge,
  InstallStatusBadge,
  NumberStatusBadge,
  OrderStatusBadge,
  methodLabel,
} from "@/components/app/status-badges";
import { daysLeft, formatBytes, formatDate, formatDateTime, formatDuration, formatPhone, relativeTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Usuario · Admin" };

const DEAD = ["CANCEL", "USED_EXPIRED", "UNUSED_EXPIRED", "REVOKED"];

function isExpired(o: Order, now: number) {
  return o.status === "ready" && ((!!o.expiresAt && o.expiresAt.getTime() < now) || DEAD.includes(o.esimStatus ?? ""));
}

async function topupOptions(o: Order): Promise<TopupOption[]> {
  try {
    return await Promise.race([getTopupOptions(o), new Promise<TopupOption[]>((r) => setTimeout(() => r([]), 6_000))]);
  } catch {
    return [];
  }
}

function Panel({ id, title, count, aside, children }: { id: string; title: string; count?: number; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-32 flex-col gap-3">
      <SectionTitle id={`${id}-title`} count={count} aside={aside}>
        {title}
      </SectionTitle>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-border-strong px-5 py-8 text-center text-sm text-muted">{children}</p>;
}

function EsimCard({ order: o, options, now, userId }: { order: Order; options: TopupOption[]; now: number; userId: string }) {
  const expired = isExpired(o, now);
  const live = o.status === "ready" && !expired;
  const neverInstalled = !o.smdpStatus || o.smdpStatus === "RELEASED";
  const days = daysLeft(o.expiresAt, now);
  const used = Number(o.usedBytes ?? 0);
  const total = Number(o.totalBytes ?? 0);
  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-display text-base font-semibold text-fg">{o.planName}</h3>
          <p className="text-[13px] text-subtle">
            Comprada {formatDateTime(o.createdAt)} · <span className="tabular-nums">{formatMxn(o.priceCents)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <OrderStatusBadge status={o.status} expired={expired} suspended={o.suspended} />
          {o.status === "ready" ? <InstallStatusBadge smdpStatus={o.smdpStatus} /> : null}
        </div>
      </div>

      {o.status === "ready" && total > 0 ? (
        <div className="flex flex-col gap-1.5">
          <UsageBar used={used} total={total} label={`Datos usados de ${o.planName}`} />
          <p className="flex justify-between text-[12px] text-muted tabular-nums">
            <span>
              {formatBytes(used)} de {formatBytes(total)}
            </span>
            <span>{formatBytes(Math.max(0, total - used))} restantes</span>
          </p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Detail label="Vence">
          {o.expiresAt ? (
            <>
              {formatDate(o.expiresAt)}
              {days !== null ? <span className="text-subtle"> · {days} d</span> : null}
            </>
          ) : (
            "Al activarse"
          )}
        </Detail>
        <Detail label="Activada">{o.activatedAt ? formatDate(o.activatedAt) : "—"}</Detail>
        <Detail label="Sincronizada">{o.usageSyncedAt ? relativeTime(o.usageSyncedAt, now) : "Nunca"}</Detail>
        <Detail label="Estado proveedor">
          <span className="font-mono text-[12px]">{o.esimStatus ?? "—"}</span>
        </Detail>
        <Detail label="ICCID">
          {o.iccid ? (
            <span className="flex items-center gap-1">
              <span className="truncate font-mono text-[12px]">{o.iccid}</span>
              <CopyButton value={o.iccid} ariaLabel="Copiar ICCID" size="icon-sm" variant="ghost" />
            </span>
          ) : (
            "—"
          )}
        </Detail>
        <Detail label="Orden proveedor">
          <span className="font-mono text-[12px]">{o.providerOrderNo ?? "—"}</span>
        </Detail>
        <Detail label="Auto-recarga">{o.autoTopupPlanId ? <span className="font-mono text-[12px]">{o.autoTopupPlanId}</span> : "No"}</Detail>
        <Detail label="Correo QR">{o.emailedAt ? formatDateTime(o.emailedAt) : "No enviado"}</Detail>
      </dl>

      {o.error ? <Alert variant="error">{o.error}</Alert> : null}

      <ActionGroup>
        <ActionButton action={adminSyncEsims} fields={{ orderId: o.id, userId }} pendingText="Sincronizando…">
          <RefreshCw aria-hidden /> Sincronizar
        </ActionButton>
        {o.activationCode ? (
          <ActionButton action={adminResendEsimEmail} fields={{ orderId: o.id }} pendingText="Enviando…">
            <Mail aria-hidden /> Reenviar correo
          </ActionButton>
        ) : null}
        {live && options.length > 0 ? (
          <ConfirmAction
            action={adminTopupEsim}
            fields={{ orderId: o.id }}
            label={
              <>
                <Zap aria-hidden /> Recargar
              </>
            }
            title="Recargar eSIM"
            description={`Se aplica a ${o.planName}. Si no es de cortesía, se cobra del saldo del usuario.`}
            confirmLabel="Aplicar recarga"
            pendingText="Aplicando…"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor={`topup-${o.id}`} className="text-sm font-medium text-fg">
                Paquete
              </label>
              <Select id={`topup-${o.id}`} name="planId" required defaultValue={options[0].planId}>
                {options.map((t) => (
                  <option key={t.planId} value={t.planId}>
                    {t.name} · {formatGb(t.dataGb)} · {t.days} días · ${t.priceMxn.toLocaleString("es-MX")}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-fg">
              <input type="checkbox" name="free" value="1" className="size-4 accent-primary" />
              Cortesía (no cobrar al usuario)
            </label>
          </ConfirmAction>
        ) : null}
        {live ? (
          o.suspended ? (
            <ConfirmAction
              action={adminSuspendEsim}
              fields={{ orderId: o.id, suspend: "0" }}
              label={
                <>
                  <Play aria-hidden /> Reactivar
                </>
              }
              title="¿Reactivar eSIM?"
              description="El usuario vuelve a tener datos de inmediato."
              confirmLabel="Sí, reactivar"
              pendingText="Reactivando…"
            />
          ) : (
            <ConfirmAction
              action={adminSuspendEsim}
              fields={{ orderId: o.id, suspend: "1" }}
              label={
                <>
                  <Pause aria-hidden /> Pausar
                </>
              }
              title="¿Pausar eSIM?"
              description="El usuario se queda sin datos hasta que la reactives. La vigencia sigue corriendo."
              confirmLabel="Sí, pausar"
              confirmVariant="danger"
              pendingText="Pausando…"
            />
          )
        ) : null}
        {live && neverInstalled ? (
          <ConfirmAction
            action={adminCancelEsim}
            fields={{ orderId: o.id }}
            variant="ghost"
            label={
              <>
                <XCircle aria-hidden /> Cancelar eSIM
              </>
            }
            title="¿Cancelar eSIM?"
            description="Solo es posible porque nunca se instaló. Se cancela con el proveedor y se devuelve el saldo al usuario. No se puede deshacer."
            confirmLabel="Sí, cancelar eSIM"
            confirmVariant="danger"
            pendingText="Cancelando…"
          />
        ) : null}
      </ActionGroup>
    </Card>
  );
}

export default async function AdminUserPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const d = await getUserDetail(id);
  if (!d) notFound();
  const now = new Date().getTime();
  const { user: u } = d;
  const self = u.id === admin.id;
  const isAdmin = u.role === "admin";
  const disabled = !!u.disabledAt;

  const options = new Map<string, TopupOption[]>(
    await Promise.all(
      d.orders.filter((o) => o.status === "ready" && !isExpired(o, now)).map(async (o) => [o.id, await topupOptions(o)] as const),
    ),
  );
  const activeEsims = d.orders.filter((o) => o.status === "ready" && !isExpired(o, now)).length;
  const deposited = d.deposits.filter((x) => x.status === "completed").reduce((a, x) => a + x.amountCents, 0);

  const jump = [
    { href: "#esims", label: "eSIMs", n: d.orders.length },
    { href: "#numero", label: "Número", n: d.number ? 1 : 0 },
    { href: "#depositos", label: "Depósitos", n: d.deposits.length },
    { href: "#movimientos", label: "Movimientos", n: d.ledger.length },
    { href: "#recargas", label: "Recargas", n: d.topups.length },
    { href: "#bitacora", label: "Bitácora", n: d.audit.length },
  ];

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Link
        href="/admin/usuarios"
        className="-ml-1 -mb-4 inline-flex h-9 w-fit items-center gap-1 rounded-[10px] pl-1 pr-2.5 text-sm text-muted transition-colors hover:bg-white/[0.05] hover:text-fg"
      >
        <ChevronLeft aria-hidden className="size-4" /> Usuarios
      </Link>

      {/* Header */}
      <Card className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-lavender/20 bg-primary/10 font-display text-lg font-semibold text-lavender-soft"
            >
              {u.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="truncate text-2xl font-semibold text-fg">{u.name}</h1>
              <p className="flex min-w-0 items-center gap-1 text-[15px] text-muted">
                <span className="truncate">{u.email}</span>
                <CopyButton value={u.email} ariaLabel="Copiar correo" size="icon-sm" variant="ghost" />
              </p>
              <div className="flex flex-wrap gap-1.5">
                {isAdmin ? <Badge variant="primary">Admin</Badge> : null}
                {disabled ? <Badge variant="danger">Suspendido</Badge> : <Badge variant="success" dot>Activo</Badge>}
                {u.emailVerifiedAt ? <Badge variant="neutral">Correo verificado</Badge> : <Badge variant="warning">Sin verificar</Badge>}
                {self ? <Badge variant="accent">Tú</Badge> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:items-end">
            <span className="text-[13px] text-muted">Saldo</span>
            <span className="font-display text-3xl font-semibold tracking-tight text-fg tabular-nums">{formatMxn(u.balanceCents)}</span>
            <span className="text-[12px] text-subtle tabular-nums">Depositado {formatMxn(deposited)}</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-5 sm:grid-cols-3 lg:grid-cols-6">
          <Detail label="Registro">{formatDateTime(u.createdAt)}</Detail>
          <Detail label="Última actividad">
            <span title={u.lastSeenAt ? formatDateTime(u.lastSeenAt) : undefined}>{u.lastSeenAt ? relativeTime(u.lastSeenAt, now) : "Nunca"}</span>
          </Detail>
          <Detail label="Último inicio de sesión">{d.sessions.lastLogin ? formatDateTime(d.sessions.lastLogin) : "—"}</Detail>
          <Detail label="Sesiones activas">
            <span className="tabular-nums">{d.sessions.active}</span>
          </Detail>
          <Detail label="eSIMs activas">
            <span className="tabular-nums">
              {activeEsims} de {d.orders.length}
            </span>
          </Detail>
          <Detail label="Suspendido">{u.disabledAt ? formatDateTime(u.disabledAt) : "No"}</Detail>
        </dl>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-surface-2/60 px-4 py-3">
            <Landmark aria-hidden className="size-4 shrink-0 text-lavender" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] text-subtle">CLABE</span>
              <span className="truncate font-mono text-[15px] text-fg tabular-nums">{u.clabe ?? "Sin asignar"}</span>
            </div>
            {u.clabe ? <CopyButton value={u.clabe} ariaLabel="Copiar CLABE" size="icon-sm" /> : null}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-surface-2/60 px-4 py-3">
            <KeyRound aria-hidden className="size-4 shrink-0 text-lavender" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12px] text-subtle">ID de usuario</span>
              <span className="truncate font-mono text-[13px] text-muted">{u.id}</span>
            </div>
            <CopyButton value={u.id} ariaLabel="Copiar ID" size="icon-sm" />
          </div>
        </div>

        {u.adminNote ? (
          <Alert variant="info" title="Nota interna" icon={<StickyNote aria-hidden />}>
            <span className="whitespace-pre-line">{u.adminNote}</span>
          </Alert>
        ) : null}
      </Card>

      {/* Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet aria-hidden className="size-4 text-lavender" /> Ajustar saldo
            </CardTitle>
            <CardDescription>Abono o cargo manual con motivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdjustBalanceForm userId={u.id} balanceCents={u.balanceCents} action={adminAdjustBalance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield aria-hidden className="size-4 text-lavender" /> Cuenta
            </CardTitle>
            <CardDescription>Acceso, rol y verificación.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionGroup>
              {self ? null : disabled ? (
                <ConfirmAction
                  action={adminSetDisabled}
                  fields={{ userId: u.id, disabled: "0" }}
                  label={
                    <>
                      <UserCheck aria-hidden /> Reactivar cuenta
                    </>
                  }
                  title="¿Reactivar cuenta?"
                  description={`${u.email} podrá volver a entrar y comprar.`}
                  confirmLabel="Sí, reactivar"
                  pendingText="Reactivando…"
                >
                  <ReasonField />
                </ConfirmAction>
              ) : (
                <ConfirmAction
                  action={adminSetDisabled}
                  fields={{ userId: u.id, disabled: "1" }}
                  variant="danger"
                  label={
                    <>
                      <UserX aria-hidden /> Suspender cuenta
                    </>
                  }
                  title="¿Suspender cuenta?"
                  description={`${u.email} no podrá entrar ni comprar, y se cerrarán todas sus sesiones. Sus eSIMs siguen funcionando.`}
                  confirmLabel="Sí, suspender"
                  confirmVariant="danger"
                  pendingText="Suspendiendo…"
                >
                  <ReasonField />
                </ConfirmAction>
              )}
              {self ? null : isAdmin ? (
                <ConfirmAction
                  action={adminSetRole}
                  fields={{ userId: u.id, role: "user" }}
                  label={
                    <>
                      <ShieldOff aria-hidden /> Quitar admin
                    </>
                  }
                  title="¿Quitar rol de administrador?"
                  description={`${u.email} perderá acceso al panel de admin.`}
                  confirmLabel="Sí, quitar admin"
                  confirmVariant="danger"
                  pendingText="Guardando…"
                />
              ) : (
                <ConfirmAction
                  action={adminSetRole}
                  fields={{ userId: u.id, role: "admin" }}
                  label={
                    <>
                      <Shield aria-hidden /> Hacer admin
                    </>
                  }
                  title="¿Hacer administrador?"
                  description={`${u.email} tendrá acceso completo al panel: saldos, usuarios y proveedores.`}
                  confirmLabel="Sí, hacer admin"
                  confirmVariant="danger"
                  pendingText="Guardando…"
                />
              )}
              <ConfirmAction
                action={adminLogoutUser}
                fields={{ userId: u.id }}
                label={
                  <>
                    <LogOut aria-hidden /> Cerrar sesiones
                  </>
                }
                title="¿Cerrar todas las sesiones?"
                description={`${u.email} tendrá que volver a iniciar sesión en todos sus dispositivos (${d.sessions.active} activas).`}
                confirmLabel="Sí, cerrar sesiones"
                confirmVariant="danger"
                pendingText="Cerrando…"
              />
              {!u.emailVerifiedAt ? (
                <ActionButton action={adminVerifyEmail} fields={{ userId: u.id }} pendingText="Guardando…">
                  <MailCheck aria-hidden /> Marcar correo verificado
                </ActionButton>
              ) : null}
              {!u.clabe ? (
                <ActionButton action={adminEnsureClabe} fields={{ userId: u.id }} pendingText="Asignando…">
                  <Landmark aria-hidden /> Asignar CLABE
                </ActionButton>
              ) : null}
            </ActionGroup>
            {self ? <p className="mt-3 text-[12px] text-subtle">No puedes suspenderte ni quitarte el rol de admin.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote aria-hidden className="size-4 text-lavender" /> Nota interna
            </CardTitle>
            <CardDescription>Contexto para el equipo. El usuario no la ve.</CardDescription>
          </CardHeader>
          <CardContent>
            <NoteForm userId={u.id} note={u.adminNote} action={adminSetNote} />
          </CardContent>
        </Card>
      </div>

      {/* Jump nav */}
      <nav aria-label="Secciones del usuario" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          {jump.map((j) => (
            <li key={j.href}>
              <a
                href={j.href}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white/[0.02] px-3.5 text-[13px] font-medium text-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                {j.label} <span className="text-subtle tabular-nums">{j.n}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* eSIMs */}
      <Panel
        id="esims"
        title="eSIMs"
        count={d.orders.length}
        aside={
          d.orders.length ? (
            <ActionButton action={adminSyncEsims} fields={{ userId: u.id }} variant="ghost" pendingText="Sincronizando…">
              <RefreshCw aria-hidden /> Sincronizar todas
            </ActionButton>
          ) : null
        }
      >
        {d.orders.length === 0 ? (
          <Empty>
            <CardSim aria-hidden className="mx-auto mb-2 size-5 text-subtle" />
            Sin eSIMs.
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {d.orders.map((o) => (
              <EsimCard key={o.id} order={o} options={options.get(o.id) ?? []} now={now} userId={u.id} />
            ))}
          </div>
        )}
      </Panel>

      {/* Number */}
      <Panel id="numero" title="Número">
        {!d.number ? (
          <Empty>
            <Phone aria-hidden className="mx-auto mb-2 size-5 text-subtle" />
            Sin número asignado.
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-lg text-fg tabular-nums">{formatPhone(d.number.e164)}</span>
                  <span className="text-[13px] text-subtle">
                    {d.number.country} · {d.number.provider}
                  </span>
                </div>
                <NumberStatusBadge graceUntil={d.number.graceUntil} autoRenew={d.number.autoRenew} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Detail label="Asignado">{formatDate(d.number.assignedAt)}</Detail>
                <Detail label="Renueva">{formatDate(d.number.renewsAt)}</Detail>
                <Detail label="Precio mensual">{d.number.monthlyPriceCents !== null ? formatMxn(d.number.monthlyPriceCents) : "—"}</Detail>
                <Detail label="Auto-renovación">{d.number.autoRenew ? "Sí" : "No"}</Detail>
                {d.number.graceUntil ? <Detail label="Gracia hasta">{formatDate(d.number.graceUntil)}</Detail> : null}
              </dl>
              <Link href="/admin/numeros" className="text-sm text-lavender hover:text-lavender-soft">
                Gestionar en Números
              </Link>
            </Card>
            <Card className="overflow-hidden lg:col-span-2">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <h3 className="text-sm font-semibold text-fg">
                  SMS recientes <span className="font-normal text-subtle tabular-nums">({d.sms.length})</span>
                </h3>
              </div>
              {d.sms.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted">Sin SMS.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                  {d.sms.slice(0, 20).map((m) => (
                    <li key={m.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:px-5">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="font-medium text-fg">{formatPhone(m.fromNumber)}</span>
                        <span className="shrink-0 text-subtle">{formatDateTime(m.receivedAt)}</span>
                      </div>
                      <p className="break-words text-sm text-muted">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-y border-border px-4 py-3 sm:px-5">
                <h3 className="text-sm font-semibold text-fg">
                  Llamadas recientes <span className="font-normal text-subtle tabular-nums">({d.calls.length})</span>
                </h3>
              </div>
              {d.calls.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted">Sin llamadas.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {d.calls.slice(0, 20).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px] sm:px-5">
                      <PhoneIncoming aria-hidden className="size-4 shrink-0 text-subtle" />
                      <span className="min-w-0 flex-1 truncate text-fg">{formatPhone(c.fromNumber)}</span>
                      <Badge variant={c.status === "answered" ? "success" : c.status === "missed" ? "warning" : "neutral"}>
                        {c.status === "answered" ? "Contestada" : c.status === "missed" ? "Perdida" : c.status === "voicemail" ? "Buzón" : "Rechazada"}
                      </Badge>
                      <span className="w-16 text-right text-muted tabular-nums">{formatDuration(c.durationSec)}</span>
                      <span className="hidden text-subtle sm:inline">{formatDateTime(c.startedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Panel>

      {/* Deposits */}
      <Panel id="depositos" title="Depósitos" count={d.deposits.length}>
        {d.deposits.length === 0 ? (
          <Empty>Sin depósitos.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <th className={th}>Fecha</th>
                    <th className={th}>Método</th>
                    <th className={th}>Referencia</th>
                    <th className={th}>Ordenante</th>
                    <th className={th}>Estado</th>
                    <th className={`${th} text-right`}>Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.deposits.map((x) => (
                    <tr key={x.id}>
                      <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(x.createdAt)}</td>
                      <td className={td}>{methodLabel(x.method)}</td>
                      <td className={`${td} font-mono text-[13px] text-fg`}>{x.reference}</td>
                      <td className={`${td} text-muted`}>{typeof x.meta?.payerName === "string" ? x.meta.payerName : "—"}</td>
                      <td className={td}>
                        <DepositStatusBadge status={x.status} />
                      </td>
                      <td className={`${td} text-right`}>
                        <span className={money}>{formatMxn(x.amountCents)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {d.deposits.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm text-fg">
                      {methodLabel(x.method)} · <span className="font-mono text-[13px]">{x.reference}</span>
                    </span>
                    <span className="text-[12px] text-subtle">{formatDateTime(x.createdAt)}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={money}>{formatMxn(x.amountCents)}</span>
                    <DepositStatusBadge status={x.status} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Panel>

      {/* Ledger */}
      <Panel id="movimientos" title="Movimientos" count={d.ledger.length}>
        {d.ledger.length === 0 ? (
          <Empty>Sin movimientos de saldo.</Empty>
        ) : (
          <Card className="px-4 sm:px-5">
            <ul className="divide-y divide-border">
              {d.ledger.map((e) => (
                <LedgerRow key={e.id} entry={e} />
              ))}
            </ul>
          </Card>
        )}
      </Panel>

      {/* Topups */}
      <Panel id="recargas" title="Recargas" count={d.topups.length}>
        {d.topups.length === 0 ? (
          <Empty>Sin recargas.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {d.topups.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Zap aria-hidden className={clsx("size-4 shrink-0", t.status === "applied" ? "text-info" : "text-subtle")} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-fg">
                      {t.planName}
                      {t.auto ? <span className="font-normal text-subtle"> · automática</span> : null}
                    </span>
                    <span className="text-[12px] text-subtle">
                      {formatDateTime(t.createdAt)}
                      {t.error ? <span className="text-danger"> · {t.error}</span> : null}
                    </span>
                  </div>
                  <Badge variant={t.status === "applied" ? "success" : t.status === "pending" ? "warning" : "neutral"}>
                    {t.status === "applied" ? "Aplicada" : t.status === "pending" ? "Pendiente" : "Reembolsada"}
                  </Badge>
                  <span className={`${money} w-20 text-right text-sm`}>{t.priceCents ? formatMxn(t.priceCents) : "Cortesía"}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Panel>

      {/* Audit */}
      <Panel id="bitacora" title="Bitácora" count={d.audit.length}>
        <Card className="overflow-hidden">
          <AuditList rows={d.audit} showTarget={false} />
        </Card>
      </Panel>
    </div>
  );
}

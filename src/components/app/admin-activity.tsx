import Link from "next/link";
import clsx from "clsx";
import { ArrowDownLeft, CardSim, MessageSquareText, Phone, ShieldCheck, UserPlus, Zap, type LucideIcon } from "lucide-react";
import type { ActivityItem } from "@/lib/admin";
import type { AdminAudit } from "@/db/schema";
import { formatMxn } from "@/lib/pricing";
import { clockTime, dayKey, dayLabel, formatDateTime, relativeTime } from "./format";

const TYPES: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  signup: { icon: UserPlus, label: "Registro", tone: "text-accent bg-accent/10 border-accent/20" },
  deposit: { icon: ArrowDownLeft, label: "Depósito", tone: "text-success bg-success/10 border-success/20" },
  esim: { icon: CardSim, label: "eSIM", tone: "text-lavender bg-primary/10 border-lavender/20" },
  topup: { icon: Zap, label: "Recarga", tone: "text-info bg-info/10 border-info/20" },
  number: { icon: Phone, label: "Número", tone: "text-warning bg-warning/10 border-warning/20" },
  sms: { icon: MessageSquareText, label: "SMS", tone: "text-muted bg-white/[0.04] border-border" },
};

function ActivityRow({ item, now, timeOnly }: { item: ActivityItem; now: number; timeOnly?: boolean }) {
  const t = TYPES[item.type] ?? TYPES.sms;
  const Icon = t.icon;
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-xl border", t.tone)}>
        <Icon aria-hidden className="size-4" />
        <span className="sr-only">{t.label}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm text-fg">
          <span className="font-medium">{item.title}</span>
          {item.detail ? <span className="text-muted"> · {item.detail}</span> : null}
        </p>
        <p className="truncate text-[13px] text-subtle">
          {item.userId ? (
            <Link href={`/admin/usuarios/${item.userId}`} className="text-muted hover:text-lavender-soft">
              {item.email ?? "Usuario"}
            </Link>
          ) : (
            (item.email ?? "Sin usuario")
          )}{" "}
          ·{" "}
          <time dateTime={new Date(item.at).toISOString()} title={formatDateTime(item.at)}>
            {timeOnly ? clockTime(item.at) : relativeTime(item.at, now)}
          </time>
        </p>
      </div>
      {item.amountCents !== undefined && item.amountCents !== 0 ? (
        <span
          className={clsx(
            "shrink-0 font-display text-sm font-semibold tabular-nums",
            item.type === "deposit" ? "text-success" : "text-fg",
          )}
        >
          {item.type === "deposit" ? "+" : ""}
          {formatMxn(item.amountCents)}
        </span>
      ) : null}
    </li>
  );
}

/** Activity feed. With `grouped`, items are grouped by day (CDMX). */
export function ActivityFeed({ items, now, grouped = false }: { items: ActivityItem[]; now: number; grouped?: boolean }) {
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted">Sin actividad todavía.</p>;
  }
  if (!grouped) {
    return (
      <ul className="divide-y divide-border">
        {items.map((it, i) => (
          <ActivityRow key={`${it.type}-${i}`} item={it} now={now} />
        ))}
      </ul>
    );
  }
  const groups = new Map<string, ActivityItem[]>();
  for (const it of items) {
    const k = dayKey(it.at);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return (
    <div className="flex flex-col">
      {[...groups.entries()].map(([k, list]) => (
        <section key={k} aria-label={dayLabel(list[0].at, now)}>
          <h3 className="border-y border-border bg-surface-2/50 px-4 py-2 text-[12px] font-medium uppercase tracking-wider text-subtle sm:px-5">
            {dayLabel(list[0].at, now)} <span className="tabular-nums">· {list.length}</span>
          </h3>
          <ul className="divide-y divide-border">
            {list.map((it, i) => (
              <ActivityRow key={`${it.type}-${i}`} item={it} now={now} timeOnly />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------- Audit --------------------------------- */

const ACTIONS: Record<string, string> = {
  "balance.adjust": "Ajuste de saldo",
  "user.disable": "Cuenta suspendida",
  "user.enable": "Cuenta reactivada",
  "user.role": "Cambio de rol",
  "user.note": "Nota interna actualizada",
  "user.logout": "Sesiones cerradas",
  "user.verify": "Correo verificado",
  "user.clabe": "CLABE asignada",
  "novacore.reconcile": "Conciliación NOVACORE",
  "esim.sync": "Sincronización de eSIM",
  "esim.cancel": "eSIM cancelada",
  "esim.suspend": "eSIM pausada",
  "esim.unsuspend": "eSIM reactivada",
  "esim.topup": "Recarga cobrada",
  "esim.topup.free": "Recarga de cortesía",
  "esim.resend_email": "Correo de instalación reenviado",
  "catalog.sync": "Catálogo sincronizado",
  "plan.enable": "Plan activado",
  "plan.disable": "Plan oculto",
};

export const auditLabel = (action: string) => ACTIONS[action] ?? action;

const KEY_LABELS: Record<string, string> = {
  cents: "Monto",
  reason: "Motivo",
  balanceAfter: "Saldo final",
  role: "Rol",
  clabe: "CLABE",
  count: "eSIMs",
  planId: "Plan",
  seen: "Revisados",
  credited: "Acreditados",
  returned: "Devueltos",
  plans: "Planes",
  fx: "Tipo de cambio",
};

function formatDetail(k: string, v: unknown) {
  if ((k === "cents" || k === "balanceAfter") && typeof v === "number") return `${v > 0 && k === "cents" ? "+" : ""}${formatMxn(v)}`;
  if (k === "role") return v === "admin" ? "Administrador" : "Usuario";
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v);
}

type AuditRow = AdminAudit & { adminEmail: string };

function auditTargetHref(row: AuditRow) {
  if (row.targetType === "user" && row.targetId) return `/admin/usuarios/${row.targetId}`;
  const uid = row.details && typeof row.details.userId === "string" ? row.details.userId : null;
  if (uid) return `/admin/usuarios/${uid}`;
  return null;
}

export function AuditList({ rows, showTarget = true }: { rows: AuditRow[]; showTarget?: boolean }) {
  if (rows.length === 0) return <p className="px-5 py-10 text-center text-sm text-muted">Sin acciones registradas.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const details = Object.entries(r.details ?? {}).filter(([k, v]) => k !== "userId" && v !== undefined && v !== null && v !== "");
        const href = showTarget ? auditTargetHref(r) : null;
        return (
          <li key={r.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-lavender/20 bg-primary/10 text-lavender">
              <ShieldCheck aria-hidden className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-fg">{auditLabel(r.action)}</p>
                <time className="text-[12px] text-subtle tabular-nums" dateTime={new Date(r.createdAt).toISOString()}>
                  {formatDateTime(r.createdAt)}
                </time>
              </div>
              <p className="truncate text-[13px] text-subtle">
                por <span className="text-muted">{r.adminEmail}</span>
                {href ? (
                  <>
                    {" · "}
                    <Link href={href} className="text-lavender hover:text-lavender-soft">
                      Ver usuario
                    </Link>
                  </>
                ) : r.targetType !== "user" && r.targetId ? (
                  <span className="font-mono"> · {r.targetType} {r.targetId}</span>
                ) : null}
              </p>
              {details.length ? (
                <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {details.map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                      <dt className="text-subtle">{KEY_LABELS[k] ?? k}:</dt>
                      <dd className="break-all text-muted tabular-nums">{formatDetail(k, v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import Form from "next/form";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------- Table styles ------------------------------ */

export const th = "px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider text-subtle whitespace-nowrap";
export const td = "px-4 py-3.5 text-sm align-middle";
export const money = "font-display font-semibold text-fg tabular-nums whitespace-nowrap";

/** Builds `/path?k=v` skipping empty / default values. */
export function hrefWith(path: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === "all" || v === 0) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

/** Reads a single string search param. */
export function param(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/* --------------------------------- Layout --------------------------------- */

export function AdminHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold text-fg sm:text-3xl">{title}</h1>
        {description ? <p className="text-[15px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-start gap-2">{action}</div> : null}
    </header>
  );
}

export function SectionTitle({ id, children, aside, count }: { id?: string; children: ReactNode; aside?: ReactNode; count?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold text-fg">
        {children}
        {count !== undefined ? <span className="ml-1.5 text-sm font-normal text-subtle tabular-nums">({count.toLocaleString("es-MX")})</span> : null}
      </h2>
      {aside}
    </div>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-border-strong px-5 py-10 text-center text-sm text-muted">{children}</p>
  );
}

/** KPI tile. */
export function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "warning" | "danger" | "success";
}) {
  return (
    <Card className="flex h-full flex-col gap-2 p-4 sm:p-5">
      <span className="inline-flex items-center gap-2 text-[13px] text-muted [&_svg]:size-4 [&_svg]:text-lavender">
        {icon}
        {label}
      </span>
      <span className="truncate font-display text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</span>
      {hint ? (
        <span
          className={clsx(
            "text-[13px]",
            tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-subtle",
          )}
        >
          {hint}
        </span>
      ) : null}
    </Card>
  );
}

/* --------------------------------- Filters -------------------------------- */

export type Chip = { value: string; label: string; count?: number };

/** Filter chips rendered as links (keyboard + no JS). */
export function FilterChips({
  label,
  chips,
  current,
  hrefFor,
}: {
  label: string;
  chips: Chip[];
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max items-center gap-1.5 sm:w-auto sm:flex-wrap">
        {chips.map((c) => {
          const active = c.value === current;
          return (
            <li key={c.value}>
              <Link
                href={hrefFor(c.value)}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={clsx(
                  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-200",
                  active
                    ? "border-lavender/30 bg-primary/15 text-fg"
                    : "border-border bg-white/[0.02] text-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {c.label}
                {c.count !== undefined ? <span className="text-subtle tabular-nums">{c.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** GET search form that keeps the other params as hidden inputs. */
export function SearchBox({
  action,
  q,
  placeholder,
  keep = {},
  label = "Buscar",
}: {
  action: string;
  q: string;
  placeholder: string;
  keep?: Record<string, string>;
  label?: string;
}) {
  return (
    <Form action={action} role="search" className="flex w-full gap-2 sm:max-w-md">
      {Object.entries(keep).map(([k, v]) => (v && v !== "all" ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="min-w-0 flex-1">
        <label htmlFor={`q-${action}`} className="sr-only">
          {label}
        </label>
        <Input
          id={`q-${action}`}
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          leading={<Search />}
        />
      </div>
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center rounded-control border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:border-border-strong"
      >
        Buscar
      </button>
    </Form>
  );
}

export function Pagination({
  total,
  offset,
  limit,
  hrefFor,
}: {
  total: number;
  offset: number;
  limit: number;
  hrefFor: (offset: number) => string;
}) {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + limit);
  const prev = offset > 0 ? Math.max(0, offset - limit) : null;
  const next = offset + limit < total ? offset + limit : null;
  const link =
    "inline-flex h-9 items-center gap-1 rounded-[10px] border border-border px-3 text-sm text-fg transition-colors hover:border-border-strong";
  const off = "inline-flex h-9 items-center gap-1 rounded-[10px] border border-border px-3 text-sm text-subtle opacity-50";
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
      <p className="text-[13px] text-muted tabular-nums">
        {from.toLocaleString("es-MX")}–{to.toLocaleString("es-MX")} de {total.toLocaleString("es-MX")}
      </p>
      <div className="flex gap-2">
        {prev !== null ? (
          <Link href={hrefFor(prev)} className={link} rel="prev">
            <ChevronLeft aria-hidden className="size-4" /> Anterior
          </Link>
        ) : (
          <span className={off} aria-disabled="true">
            <ChevronLeft aria-hidden className="size-4" /> Anterior
          </span>
        )}
        {next !== null ? (
          <Link href={hrefFor(next)} className={link} rel="next">
            Siguiente <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span className={off} aria-disabled="true">
            Siguiente <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Name + email linking to the user's profile. */
export function UserLink({ id, email, name, stretched }: { id: string; email: string | null; name?: string | null; stretched?: boolean }) {
  return (
    <Link
      href={`/admin/usuarios/${id}`}
      className={clsx(
        "group flex min-w-0 flex-col rounded-md outline-offset-2",
        stretched && "after:absolute after:inset-0 after:content-['']",
      )}
    >
      {name ? <span className="truncate font-medium text-fg group-hover:text-lavender-soft">{name}</span> : null}
      <span className={clsx("truncate", name ? "text-[13px] text-subtle" : "text-fg group-hover:text-lavender-soft")}>
        {email ?? "—"}
      </span>
    </Link>
  );
}

/** Definition list row for detail panels. */
export function Detail({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[12px] text-subtle">{label}</dt>
      <dd className="min-w-0 text-sm text-fg">{children}</dd>
    </div>
  );
}

/* -------------------------------- Skeletons ------------------------------- */

export function ListPageSkeleton({ label, chips = 6, rows = 8 }: { label: string; chips?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-6 pb-12" aria-busy="true" aria-label={label}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full max-w-md rounded-control" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: chips }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <Card className="flex flex-col divide-y divide-border overflow-hidden">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}

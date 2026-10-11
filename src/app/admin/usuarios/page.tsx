import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { listUsers, type UserFilter } from "@/lib/admin";
import { formatMxn } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminHeader, FilterChips, Pagination, SearchBox, hrefWith, money, param, td, th } from "@/components/app/admin-ui";
import { formatDate, formatDateTime, formatPhone, relativeTime } from "@/components/app/format";

export const metadata: Metadata = { title: "Usuarios · Admin" };

const PAGE = 50;

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos 7 días" },
  { value: "with-balance", label: "Con saldo" },
  { value: "with-esim", label: "Con eSIM" },
  { value: "with-number", label: "Con número" },
  { value: "unverified", label: "Sin verificar" },
  { value: "disabled", label: "Suspendidos" },
  { value: "admins", label: "Admins" },
];

function parseFilter(v: string): UserFilter {
  return FILTERS.some((f) => f.value === v) ? (v as UserFilter) : "all";
}

type Row = Awaited<ReturnType<typeof listUsers>>["rows"][number];

function UserBadges({ u }: { u: Row }) {
  return (
    <>
      {u.role === "admin" ? <Badge variant="primary">Admin</Badge> : null}
      {u.disabled ? <Badge variant="danger">Suspendido</Badge> : null}
      {!u.verified ? <Badge variant="neutral">Sin verificar</Badge> : null}
    </>
  );
}

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 100);
  const filter = parseFilter(param(sp.filter));
  const offset = Math.max(0, Math.floor(Number(param(sp.offset)) || 0));
  const { rows, total } = await listUsers({ q, filter, limit: PAGE, offset });
  const now = new Date().getTime();
  const href = (p: { q?: string; filter?: string; offset?: number }) =>
    hrefWith("/admin/usuarios", { q: p.q ?? q, filter: p.filter ?? filter, offset: p.offset });

  return (
    <div className="flex flex-col gap-6 pb-12">
      <AdminHeader
        title="Usuarios"
        description={
          <>
            <span className="tabular-nums">{total.toLocaleString("es-MX")}</span> {total === 1 ? "usuario" : "usuarios"}
            {q || filter !== "all" ? " con estos filtros" : " registrados"}.
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <SearchBox action="/admin/usuarios" q={q} placeholder="Nombre, correo o CLABE" keep={{ filter }} label="Buscar usuarios" />
        <FilterChips label="Filtrar usuarios" chips={FILTERS} current={filter} hrefFor={(v) => href({ filter: v, offset: 0 })} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Sin resultados"
          description={q ? `No encontramos usuarios para “${q}”.` : "No hay usuarios con este filtro."}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>Usuario</th>
                  <th className={`${th} text-right`}>Saldo</th>
                  <th className={`${th} text-center`}>eSIMs</th>
                  <th className={th}>Número</th>
                  <th className={`${th} text-right`}>Depositado</th>
                  <th className={`${th} text-right`}>Gastado</th>
                  <th className={th}>CLABE</th>
                  <th className={th}>Registro</th>
                  <th className={th}>Última actividad</th>
                  <th className={th}>
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((u) => (
                  <tr key={u.id} className="relative transition-colors hover:bg-white/[0.03]">
                    <td className={`${td} max-w-72`}>
                      <Link
                        href={`/admin/usuarios/${u.id}`}
                        className="flex min-w-0 flex-col after:absolute after:inset-0 after:content-['']"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-fg">{u.name}</span>
                        </span>
                        <span className="truncate text-[13px] text-subtle">{u.email}</span>
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                        <UserBadges u={u} />
                      </div>
                    </td>
                    <td className={`${td} text-right`}>
                      <span className={u.balanceCents > 0 ? money : "font-display text-muted tabular-nums"}>{formatMxn(u.balanceCents)}</span>
                    </td>
                    <td className={`${td} text-center tabular-nums`}>
                      <span className={u.activeEsims ? "font-medium text-fg" : "text-subtle"}>{u.activeEsims}</span>
                      <span className="text-subtle">/{u.esims}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap font-mono text-[13px] text-muted`}>{u.number ? formatPhone(u.number) : "—"}</td>
                    <td className={`${td} text-right font-display tabular-nums text-muted`}>{formatMxn(u.depositedCents)}</td>
                    <td className={`${td} text-right font-display tabular-nums text-muted`}>{formatMxn(u.spentCents)}</td>
                    <td className={`${td} font-mono text-[12px] text-subtle`}>{u.clabe ?? "—"}</td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(u.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap text-muted`} title={u.lastSeenAt ? formatDateTime(u.lastSeenAt) : undefined}>
                      {u.lastSeenAt ? relativeTime(u.lastSeenAt, now) : "Nunca"}
                    </td>
                    <td className={`${td} text-subtle`}>
                      <ChevronRight aria-hidden className="size-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet */}
          <ul className="divide-y divide-border lg:hidden">
            {rows.map((u) => (
              <li key={u.id} className="relative flex flex-col gap-2.5 p-4 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/usuarios/${u.id}`} className="flex min-w-0 flex-col after:absolute after:inset-0 after:content-['']">
                    <span className="truncate font-medium text-fg">{u.name}</span>
                    <span className="truncate text-[13px] text-subtle">{u.email}</span>
                  </Link>
                  <span className={`${money} shrink-0`}>{formatMxn(u.balanceCents)}</span>
                </div>
                <div className="flex flex-wrap gap-1 empty:hidden">
                  <UserBadges u={u} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-subtle">eSIMs</dt>
                    <dd className="text-fg tabular-nums">
                      {u.activeEsims}/{u.esims}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Depositado</dt>
                    <dd className="text-fg tabular-nums">{formatMxn(u.depositedCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Gastado</dt>
                    <dd className="text-fg tabular-nums">{formatMxn(u.spentCents)}</dd>
                  </div>
                </dl>
                <p className="flex flex-wrap gap-x-3 text-[12px] text-subtle">
                  {u.number ? <span className="font-mono">{formatPhone(u.number)}</span> : null}
                  <span>Registro {formatDate(u.createdAt)}</span>
                  <span>Activo {u.lastSeenAt ? relativeTime(u.lastSeenAt, now) : "nunca"}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pagination total={total} offset={offset} limit={PAGE} hrefFor={(o) => href({ offset: o })} />
    </div>
  );
}

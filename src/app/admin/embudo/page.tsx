import type { Metadata } from "next";
import { CreditCard, Footprints, MousePointerClick, ShoppingCart } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { formatMxn } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { AdminHeader, EmptyRow, FilterChips, Kpi, SectionTitle, hrefWith, param, td, th } from "@/components/app/admin-ui";
import { formatDateTime } from "@/components/app/format";
import {
  FUNNEL_RANGES,
  STEPS,
  getBuyErrors,
  getCardSales,
  getEventTotals,
  getFunnel,
  getRecentEvents,
  parseFunnelRange,
  rangeStart,
  type FunnelRow,
} from "../_lib/funnel";

export const metadata: Metadata = { title: "Embudo · Admin" };

const num = (n: number) => n.toLocaleString("es-MX");
const pct = (n: number, d: number, digits = 0) => (d > 0 ? `${((n / d) * 100).toFixed(digits)}%` : "—");
const rowHover = "transition-colors hover:bg-white/[0.03]";

/** Tabla de pasos por dimensión: cada celda = sesiones y % sobre aterrizajes. */
function FunnelTable({ rows, label, testId }: { rows: FunnelRow[]; label: string; testId: string }) {
  if (!rows.length) return <EmptyRow>Sin datos en este rango.</EmptyRow>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" data-testid={testId}>
          <thead className="border-b border-border">
            <tr>
              <th className={th}>{label}</th>
              {STEPS.map((s) => (
                <th key={s.key} className={`${th} text-right`}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key} className={rowHover} data-testid={`${testId}-row`}>
                <td className={`${td} max-w-80 truncate font-medium text-fg`} title={r.key}>
                  {r.key}
                </td>
                {STEPS.map((s, i) => (
                  <td key={s.key} className={`${td} whitespace-nowrap text-right tabular-nums`}>
                    <span className="font-semibold text-fg">{num(r[s.key])}</span>
                    {i > 0 ? <span className="ml-1.5 text-[12px] text-subtle">{pct(r[s.key], r.page_view)}</span> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Section({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionTitle id={id} count={count}>
        {title}
      </SectionTitle>
      {children}
    </section>
  );
}

export default async function AdminFunnelPage({ searchParams }: PageProps<"/admin/embudo">) {
  await requireAdmin();
  const sp = await searchParams;
  const range = parseFunnelRange(param(sp.r));
  const since = rangeStart(range);

  const [[total], byAds, byDevice, byPath, byCampaign, totals, errors, sales, recent] = await Promise.all([
    getFunnel("all", since),
    getFunnel("ads", since),
    getFunnel("device", since),
    getFunnel("path", since, 30),
    getFunnel("campaign", since, 30),
    getEventTotals(since),
    getBuyErrors(since),
    getCardSales(since),
    getRecentEvents(100),
  ]);
  const t: FunnelRow = total ?? { key: "Total", sessions: 0, page_view: 0, plan_select: 0, buy_click: 0, checkout_redirect: 0 };
  const landings = t.page_view;

  return (
    <div className="flex flex-col gap-8 pb-12">
      <AdminHeader
        title="Embudo"
        description="Registro propio y anónimo de cada paso de la compra con tarjeta (no depende de GA4). Sesión = visitante + página de aterrizaje."
      />

      <FilterChips label="Rango" chips={FUNNEL_RANGES.map((r) => ({ value: r.value, label: r.label }))} current={range} hrefFor={(v) => hrefWith("/admin/embudo", { r: v === "hoy" ? undefined : v })} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Aterrizajes" icon={<Footprints aria-hidden />} value={<span data-testid="funnel-landings">{num(landings)}</span>} hint={`${num(t.sessions)} sesiones con eventos`} />
        <Kpi label="Clic en comprar" icon={<MousePointerClick aria-hidden />} value={num(t.buy_click)} hint={`${pct(t.buy_click, landings, 1)} de aterrizajes`} />
        <Kpi
          label="Checkouts iniciados"
          icon={<ShoppingCart aria-hidden />}
          value={<span data-testid="funnel-checkouts">{num(totals.checkout_started ?? 0)}</span>}
          hint={`${num(t.checkout_redirect)} redirecciones a Stripe`}
        />
        <Kpi
          label="Pagados"
          icon={<CreditCard aria-hidden />}
          value={<span data-testid="funnel-paid">{num(totals.paid ?? 0)}</span>}
          hint={`${formatMxn(sales.cents)} · ${num(totals.buy_error ?? 0)} errores`}
          tone={totals.buy_error ? "warning" : undefined}
        />
      </div>

      <Section id="pasos" title="Pasos">
        <Card className="p-5 sm:p-6">
          <ol className="flex flex-col gap-3" data-testid="funnel-steps">
            {STEPS.map((s) => {
              const w = landings > 0 ? Math.min(100, Math.round((t[s.key] / landings) * 100)) : 0;
              return (
                <li key={s.key} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm" data-testid={`step-${s.key}`}>
                  <span className="truncate font-medium text-fg">{s.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" role="meter" aria-label={s.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w}>
                    <div className="h-full rounded-full bg-lavender" style={{ width: `${Math.max(w, t[s.key] ? 2 : 0)}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-right tabular-nums">
                    <span className="font-semibold text-fg" data-testid={`step-${s.key}-count`}>
                      {num(t[s.key])}
                    </span>
                    <span className="ml-1.5 text-[12px] text-subtle">{pct(t[s.key], landings, 1)}</span>
                  </span>
                </li>
              );
            })}
            <li className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 border-t border-border pt-3 text-sm">
              <span className="truncate font-medium text-fg">Pagados</span>
              <span className="text-[13px] text-subtle">
                {num(sales.paid)} de {num(sales.started)} checkouts ({pct(sales.paid, sales.started, 1)})
              </span>
              <span className="whitespace-nowrap text-right font-semibold tabular-nums text-fg">{formatMxn(sales.cents)}</span>
            </li>
          </ol>
        </Card>
      </Section>

      <Section id="anuncios" title="Anuncios vs orgánico">
        <FunnelTable rows={byAds} label="Origen" testId="funnel-ads" />
      </Section>
      <Section id="dispositivo" title="Por dispositivo">
        <FunnelTable rows={byDevice} label="Dispositivo" testId="funnel-device" />
      </Section>
      <Section id="paginas" title="Por página de aterrizaje" count={byPath.length}>
        <FunnelTable rows={byPath} label="Ruta" testId="funnel-path" />
      </Section>
      <Section id="campanas" title="Por campaña · término" count={byCampaign.length}>
        <FunnelTable rows={byCampaign} label="Campaña · término" testId="funnel-campaign" />
      </Section>

      {errors.length ? (
        <Section id="errores" title="Errores al comprar" count={errors.length}>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {errors.map((e) => (
                <li key={e.code} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-mono text-fg">{e.code}</span>
                  <span className="font-semibold tabular-nums">{num(e.n)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      ) : null}

      <Section id="eventos" title="Últimos eventos" count={recent.length}>
        {recent.length === 0 ? (
          <EmptyRow>Aún no hay eventos.</EmptyRow>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="funnel-events">
                <thead className="border-b border-border">
                  <tr>
                    <th className={th}>Hora</th>
                    <th className={th}>Evento</th>
                    <th className={th}>Ruta</th>
                    <th className={th}>Disp. · país</th>
                    <th className={th}>Origen</th>
                    <th className={th}>Visitante</th>
                    <th className={th}>Datos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((e) => (
                    <tr key={e.id} className={rowHover} data-testid="funnel-event-row">
                      <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(e.ts)}</td>
                      <td className={`${td} whitespace-nowrap font-medium text-fg`}>{e.event}</td>
                      <td className={`${td} max-w-56 truncate text-muted`} title={e.path ?? ""}>
                        {e.path ?? "—"}
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>{[e.device ?? "—", e.country ?? "—"].join(" · ")}</td>
                      <td className={`${td} max-w-56 truncate text-muted`} title={[e.campaign, e.term].filter(Boolean).join(" · ")}>
                        {e.ads ? "Anuncio" : "Orgánico"}
                        {e.campaign ? ` · ${e.campaign}` : ""}
                        {e.term ? ` · ${e.term}` : ""}
                      </td>
                      <td className={`${td} font-mono text-[12px] text-subtle`}>{e.visitor ? e.visitor.slice(0, 8) : "—"}</td>
                      <td className={`${td} max-w-80 truncate font-mono text-[12px] text-subtle`} title={JSON.stringify(e.props ?? {})}>
                        {e.props && Object.keys(e.props).length ? JSON.stringify(e.props) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}

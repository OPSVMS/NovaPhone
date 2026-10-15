/**
 * Faro + NovaPhone — reporte diario de Google Ads (SOLO LECTURA: no cambia nada en la cuenta 823-438-8697).
 * Basado en Faro/docs/marketing/google-ads-report.js. Ver docs/ads/PLAN.md §6.
 *
 * Imprime, para AYER y para los ÚLTIMOS 7 DÍAS, por campaña "Nova | …" y "Faro | …":
 *   impresiones, clics, costo, CTR, CPC medio, conversiones, valor de conversión,
 *   cuota de impresiones de búsqueda (y la perdida por presupuesto / por ranking),
 * más los 40 términos de búsqueda con más clics (y costo) de cada periodo,
 * el gasto acumulado de Nova contra las compuertas del plan (MXN 2,000 / 4,000 / 7,000)
 * y una ALERTA si alguna campaña Faro está activa (deben estar todas pausadas).
 *
 * Uso: Google Ads → Herramientas → Acciones masivas → Secuencias de comandos → pegar → Vista previa
 *      → copiar TODO el registro y pegarlo al director. Correrlo una vez al día, por la mañana.
 * GAQL: todo campo del WHERE también va en el SELECT (por eso se pide segments.date y se suma aquí).
 */
var NAME_RE = /^(faro|nova) \| /i;
var NOVA_RE = /^nova \| /i;
var FARO_RE = /^faro \| /i;
var TOP_TERMS = 40;
var PLAN_START = '2026-10-16';   // D0 del plan de 21 días de NovaPhone (primer día con las campañas Nova activas)
var PLAN_DAYS = 21;
var GATES = [2000, 4000, 7000];  // compuertas de gasto (MXN), iguales a las de Faro

function main() {
  var account = AdsApp.currentAccount();
  var tz = account.getTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var yesterday = Utilities.formatDate(new Date(Date.now() - 864e5), tz, 'yyyy-MM-dd');

  function rows(q) { var out = [], it = AdsApp.search(q); while (it.hasNext()) out.push(it.next()); return out; }
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function money(micros) { return (micros / 1e6).toFixed(2); }
  function pct(x) { return x == null ? '—' : (x * 100).toFixed(1) + '%'; }
  function share(x) { return x == null ? '—' : (x <= 0.0999 ? '<10%' : pct(x)); }
  function brand(n) { return NOVA_RE.test(n) ? 'Nova' : 'Faro'; }
  function shortName(n) { return brand(n) + ' · ' + String(n).replace(NAME_RE, '').replace(/^search \| /i, ''); }
  function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

  Logger.log('REPORTE GOOGLE ADS (Nova + Faro) — cuenta ' + account.getCustomerId() + ' — generado ' + today + ' (' + tz + ') — moneda ' + account.getCurrencyCode());

  // Presupuesto diario activo, por marca
  var budget = { Nova: 0, Faro: 0 }, active = { Nova: [], Faro: [] };
  rows("SELECT campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'").forEach(function (r) {
    if (!NAME_RE.test(r.campaign.name) || r.campaign.status !== 'ENABLED') return;
    var b = brand(r.campaign.name);
    budget[b] += num(r.campaignBudget && r.campaignBudget.amountMicros);
    active[b].push(shortName(r.campaign.name));
  });
  Logger.log('Campañas Nova activas (' + active.Nova.length + '): ' + (active.Nova.join(' · ') || '—'));
  Logger.log('Presupuesto diario Nova activo: MXN ' + money(budget.Nova) + ' (plan: fase 1 = 150 · fase 2 = 280 · fase 3 = 330)');
  if (active.Faro.length) {
    Logger.log('ALERTA: ' + active.Faro.length + ' campaña(s) Faro ACTIVA(S) (deben estar pausadas; vuelve a correr novaphone-ads.js): ' + active.Faro.join(' · ') +
      ' · MXN ' + money(budget.Faro) + '/día');
  } else {
    Logger.log('Faro: todas las campañas pausadas ✓');
  }
  var braked = rows("SELECT campaign_label.resource_name, campaign.name, label.name FROM campaign_label WHERE label.name IN ('Nova|freno', 'Faro|freno')")
    .filter(function (r) { return NAME_RE.test(r.campaign.name); });
  if (braked.length) Logger.log('FRENO: ' + braked.length + ' campaña(s) con etiqueta de freno (pausadas por gasto hoy): ' + braked.map(function (r) { return shortName(r.campaign.name) + ' [' + r.label.name + ']'; }).join(' · '));

  // Gasto acumulado del plan de Nova (y Faro en el mismo periodo, que debería ser 0)
  if (yesterday >= PLAN_START) {
    var acc = { Nova: { spent: 0, clicks: 0, conv: 0 }, Faro: { spent: 0, clicks: 0, conv: 0 } };
    rows("SELECT campaign.name, segments.date, metrics.cost_micros, metrics.clicks, metrics.conversions FROM campaign " +
      "WHERE segments.date BETWEEN '" + PLAN_START + "' AND '" + yesterday + "'").forEach(function (r) {
      if (!NAME_RE.test(r.campaign.name)) return;
      var a = acc[brand(r.campaign.name)];
      a.spent += num(r.metrics.costMicros); a.clicks += num(r.metrics.clicks); a.conv += num(r.metrics.conversions);
    });
    var nDays = Math.max(1, Math.round((Date.parse(yesterday) - Date.parse(PLAN_START)) / 864e5) + 1);
    var n = acc.Nova, spentMxn = n.spent / 1e6;
    var next = GATES.filter(function (g) { return g > spentMxn; })[0];
    Logger.log('PLAN NOVA 21 DÍAS desde ' + PLAN_START + ': día ' + nDays + '/' + PLAN_DAYS + ' · gastado MXN ' + money(n.spent) + ' de ' + GATES[2] +
      ' (' + pct(spentMxn / GATES[2]) + ') · ritmo MXN ' + money(n.spent / nDays) + '/día · clics ' + n.clicks + ' · conversiones ' + n.conv.toFixed(1) +
      (n.conv > 0 ? ' · CPA MXN ' + money(n.spent / n.conv) : '') +
      (next ? ' · próxima compuerta MXN ' + next.toLocaleString('en-US') + ' (faltan MXN ' + (next - spentMxn).toFixed(0) + ')' : ' · COMPUERTA FINAL ALCANZADA'));
    GATES.forEach(function (g, i) { if (spentMxn >= g) Logger.log('  >>> COMPUERTA ' + (i + 1) + ' (MXN ' + g.toLocaleString('en-US') + ') alcanzada: el director decide (PLAN.md §4).'); });
    if (acc.Faro.spent > 0) Logger.log('ALERTA: Faro gastó MXN ' + money(acc.Faro.spent) + ' desde ' + PLAN_START + ' (debería ser 0).');
  }

  [['AYER (' + yesterday + ')', 'YESTERDAY'], ['ÚLTIMOS 7 DÍAS', 'LAST_7_DAYS']].forEach(function (p) {
    Logger.log('');
    Logger.log('==================== ' + p[0] + ' ====================');
    // ---- Campañas (se suma por día; la cuota de impresiones se pondera por impresiones elegibles = impr / cuota)
    var by = {}, order = [];
    rows("SELECT campaign.name, campaign.status, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, " +
      "metrics.conversions, metrics.conversions_value, metrics.search_impression_share, metrics.search_budget_lost_impression_share, " +
      "metrics.search_rank_lost_impression_share FROM campaign WHERE segments.date DURING " + p[1] + " AND campaign.status != 'REMOVED'").forEach(function (r) {
      if (!NAME_RE.test(r.campaign.name)) return;
      var m = r.metrics, n = r.campaign.name;
      if (!by[n]) { by[n] = { impr: 0, clicks: 0, cost: 0, conv: 0, value: 0, elig: 0, eligImpr: 0, lostB: 0, lostR: 0, status: r.campaign.status }; order.push(n); }
      var c = by[n], impr = num(m.impressions), sis = num(m.searchImpressionShare);
      c.impr += impr; c.clicks += num(m.clicks); c.cost += num(m.costMicros); c.conv += num(m.conversions); c.value += num(m.conversionsValue);
      if (sis > 0 && impr > 0) {
        var elig = impr / sis;
        c.elig += elig; c.eligImpr += impr;
        c.lostB += elig * num(m.searchBudgetLostImpressionShare);
        c.lostR += elig * num(m.searchRankLostImpressionShare);
      }
    });
    Logger.log('campaña | estado | impr | clics | costo MXN | CTR | CPC MXN | conv | valor conv | cuota impr | perdida presup. | perdida ranking');
    var tot = { Nova: { impr: 0, clicks: 0, cost: 0, conv: 0, value: 0 }, Faro: { impr: 0, clicks: 0, cost: 0, conv: 0, value: 0 } };
    order.sort(function (a, b) { return brand(b) === brand(a) ? by[b].cost - by[a].cost : (brand(a) === 'Nova' ? -1 : 1); }).forEach(function (n) {
      var c = by[n], t = tot[brand(n)];
      ['impr', 'clicks', 'cost', 'conv', 'value'].forEach(function (k) { t[k] += c[k]; });
      if (brand(n) === 'Faro' && !c.impr && !c.cost) return; // Faro pausada sin datos: no ensucia el reporte
      Logger.log([shortName(n), c.status, c.impr, c.clicks, money(c.cost), c.impr ? pct(c.clicks / c.impr) : '—',
        c.clicks ? money(c.cost / c.clicks) : '—', c.conv.toFixed(1), c.value.toFixed(2),
        c.elig ? share(c.eligImpr / c.elig) : '—', c.elig ? pct(c.lostB / c.elig) : '—', c.elig ? pct(c.lostR / c.elig) : '—'].join(' | '));
    });
    if (!order.length) Logger.log('(sin datos)');
    ['Nova', 'Faro'].forEach(function (b) {
      var t = tot[b];
      Logger.log(['TOTAL ' + b, '', t.impr, t.clicks, money(t.cost), t.impr ? pct(t.clicks / t.impr) : '—', t.clicks ? money(t.cost / t.clicks) : '—',
        t.conv.toFixed(1), t.value.toFixed(2), '', '', ''].join(' | '));
    });

    // ---- Términos de búsqueda
    var terms = {};
    rows("SELECT search_term_view.search_term, campaign.name, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, " +
      "metrics.conversions FROM search_term_view WHERE segments.date DURING " + p[1] + " AND metrics.impressions > 0").forEach(function (r) {
      if (!NAME_RE.test(r.campaign.name)) return;
      var k = r.searchTermView.searchTerm + '||' + r.campaign.name;
      var x = terms[k] || (terms[k] = { term: r.searchTermView.searchTerm, camp: shortName(r.campaign.name), impr: 0, clicks: 0, cost: 0, conv: 0 });
      x.impr += num(r.metrics.impressions); x.clicks += num(r.metrics.clicks); x.cost += num(r.metrics.costMicros); x.conv += num(r.metrics.conversions);
    });
    var list = Object.keys(terms).map(function (k) { return terms[k]; });
    list.sort(function (a, b) { return b.clicks - a.clicks || b.cost - a.cost || b.impr - a.impr; });
    Logger.log('');
    Logger.log('Top ' + TOP_TERMS + ' términos de búsqueda (' + p[0] + ', ' + list.length + ' en total):');
    Logger.log('clics | costo MXN | impr | conv | campaña | término');
    list.slice(0, TOP_TERMS).forEach(function (x) {
      Logger.log([pad(x.clicks, 3), pad(money(x.cost), 7), pad(x.impr, 4), x.conv.toFixed(1), x.camp, x.term].join(' | '));
    });
    if (!list.length) Logger.log('(sin términos)');
  });
  Logger.log('');
  Logger.log('FIN DEL REPORTE (solo lectura; no se cambió nada).');
}

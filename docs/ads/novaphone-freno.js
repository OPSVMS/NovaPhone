/**
 * NovaPhone — FRENO de gasto diario (programar CADA HORA). Ver docs/ads/PLAN.md §5.
 * Copia del freno de Faro (Faro/docs/marketing/google-ads-freno.js) con prefijo "Nova | " y etiqueta "Nova|freno".
 *
 * Google puede gastar hasta 2× el presupuesto diario en un día. Este script lo corta antes:
 *   1. Día nuevo: si hay campañas "Nova | …" con la etiqueta "Nova|freno" y la fecha guardada en la etiqueta es
 *      anterior a hoy (zona horaria de la cuenta), las REACTIVA y les quita la etiqueta. Solo esas: nunca reactiva
 *      una campaña que pausaste tú.
 *   2. Freno: si el costo de HOY de las campañas "Nova | …" activas llega a ≥ 1.15 × la suma de sus presupuestos
 *      diarios, etiqueta esas campañas con "Nova|freno" (guardando la fecha de hoy en la descripción de la etiqueta)
 *      y luego las PAUSA. Solo se pausan las que quedaron etiquetadas.
 *
 * Idempotente; seguro en Vista previa; DRY_RUN = true ni llama a mutateAll. Solo toca campañas "Nova | ".
 * Nunca toca campañas "Faro | " (esas las deja pausadas novaphone-ads.js). GAQL: todo campo del WHERE va en el SELECT.
 *
 * Instalar: Herramientas → Acciones masivas → Secuencias de comandos → + → pegar → Autorizar → Vista previa →
 *           Guardar → Frecuencia: "Cada hora". (Si "Faro freno" sigue programado, desprográmalo.)
 */
var DRY_RUN = false;
var NAME_RE = /^nova \| /i;
var LABEL = 'Nova|freno';
var FACTOR = 1.15;

function main() {
  var account = AdsApp.currentAccount();
  var preview = AdsApp.getExecutionInfo().isPreview();
  var today = Utilities.formatDate(new Date(), account.getTimeZone(), 'yyyy-MM-dd');
  function rows(q) { var out = [], it = AdsApp.search(q); while (it.hasNext()) out.push(it.next()); return out; }
  function isNova(n) { return NAME_RE.test(String(n || '')); }
  function mxn(m) { return 'MXN ' + (Number(m || 0) / 1e6).toFixed(2); }
  var safeCampaign = {}, safeLink = {}, labelRn = null;
  function assertSafe(o) {
    var t = Object.keys(o)[0], b = o[t], ok = false;
    if (t === 'campaignOperation') ok = !!(b.update && safeCampaign[b.update.resourceName] && b.updateMask === 'status');
    else if (t === 'labelOperation') ok = !!((b.create && b.create.name === LABEL) || (b.update && b.update.resourceName === labelRn && b.updateMask === 'text_label.description'));
    else if (t === 'campaignLabelOperation') ok = !!((b.create && safeCampaign[b.create.campaign] && b.create.label === labelRn) || (b.remove && safeLink[b.remove]));
    if (!ok) throw new Error('SEGURIDAD: operación fuera de Nova bloqueada: ' + JSON.stringify(o));
  }
  function apply(list) {
    if (!list.length) return [];
    list.forEach(function (x) { assertSafe(x.op); });
    if (DRY_RUN) { list.forEach(function (x) { Logger.log('(dry run) ' + x.label); }); return list.map(function () { return { ok: false, rn: null }; }); }
    var res = AdsApp.mutateAll(list.map(function (x) { return x.op; }), { partialFailure: true });
    return res.map(function (r, i) {
      var ok = r.isSuccessful(), rn = null;
      Logger.log((ok ? 'OK   ' : 'FAIL ') + list[i].label + (ok ? '' : ' :: ' + r.getErrorMessages().join(' | ')));
      try { rn = ok ? r.getResourceName() : null; } catch (e) { rn = null; }
      return { ok: ok, rn: rn };
    });
  }

  // ---------- Lecturas ----------
  var camps = {}; // rn -> {name, status, budget}
  rows("SELECT campaign.resource_name, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign " +
    "WHERE campaign.status != 'REMOVED'").forEach(function (r) {
    if (!isNova(r.campaign.name) || r.campaign.status === 'REMOVED') return;
    safeCampaign[r.campaign.resourceName] = true;
    camps[r.campaign.resourceName] = { name: r.campaign.name, status: r.campaign.status, budget: Number((r.campaignBudget && r.campaignBudget.amountMicros) || 0) };
  });
  var costBy = {}, costAll = 0;
  rows("SELECT campaign.resource_name, campaign.name, segments.date, metrics.cost_micros FROM campaign " +
    "WHERE segments.date DURING TODAY").forEach(function (r) {
    if (!isNova(r.campaign.name) || r.segments.date !== today) return;
    var c = Number(r.metrics.costMicros || 0);
    costBy[r.campaign.resourceName] = (costBy[r.campaign.resourceName] || 0) + c;
    costAll += c;
  });
  var labelDate = null;
  rows("SELECT label.resource_name, label.name, label.status, label.text_label.description FROM label " +
    "WHERE label.name = '" + LABEL + "' AND label.status = 'ENABLED'").forEach(function (r) {
    if (r.label.name !== LABEL || r.label.status !== 'ENABLED' || labelRn) return;
    labelRn = r.label.resourceName;
    labelDate = (r.label.textLabel && r.label.textLabel.description) || '';
  });
  var tagged = {}; // campaign rn -> campaign_label rn
  if (labelRn) {
    rows("SELECT campaign_label.resource_name, campaign.resource_name, campaign.name, label.resource_name FROM campaign_label " +
      "WHERE label.resource_name = '" + labelRn + "'").forEach(function (r) {
      if (!camps[r.campaign.resourceName] || r.label.resourceName !== labelRn) return;
      tagged[r.campaign.resourceName] = r.campaignLabel.resourceName;
      safeLink[r.campaignLabel.resourceName] = true;
    });
  }

  // ---------- 1. Día nuevo: reactivar lo que pausó el freno ----------
  var status = {};
  Object.keys(camps).forEach(function (rn) { status[rn] = camps[rn].status; });
  var newDay = !!labelRn && (!/^\d{4}-\d{2}-\d{2}$/.test(labelDate) || labelDate < today);
  var wake = [];
  if (newDay) {
    Object.keys(tagged).forEach(function (rn) {
      if (status[rn] === 'PAUSED') wake.push({ rn: rn, op: { campaignOperation: { update: { resourceName: rn, status: 'ENABLED' }, updateMask: 'status' } }, label: camps[rn].name + ': PAUSED -> ENABLED (día nuevo; el freno era del ' + (labelDate || '?') + ')' });
    });
  }

  // ---------- 2. Freno ----------
  // Se compara el costo de HOY de las campañas que van a correr contra la suma de SUS presupuestos (una campaña que se
  // pausó a mano a media mañana no adelanta el freno de las demás). El costo total de Nova se imprime aparte.
  var budget = 0, cost = 0;
  Object.keys(camps).forEach(function (rn) {
    var willRun = status[rn] === 'ENABLED' || wake.some(function (w) { return w.rn === rn; });
    if (willRun) { budget += camps[rn].budget; cost += costBy[rn] || 0; }
  });
  var limit = Math.round(budget * FACTOR);
  Logger.log('FRENO ' + today + ': costo de hoy ' + mxn(cost) + ' (todas las Nova: ' + mxn(costAll) + ') · presupuestos activos ' + mxn(budget) + ' · límite (×' + FACTOR + ') ' + mxn(limit) +
    (labelRn ? ' · etiqueta "' + LABEL + '" fecha ' + (labelDate || '—') + ', ' + Object.keys(tagged).length + ' campaña(s) etiquetada(s)' : ''));
  var brake = budget > 0 && cost >= limit;

  if (!wake.length && !brake) {
    // limpieza: etiquetas viejas de campañas que ya están activas (p. ej. reactivadas a mano)
    var stale = newDay ? Object.keys(tagged).filter(function (rn) { return status[rn] !== 'PAUSED'; }) : [];
    if (!stale.length) { Logger.log('Nada que cambiar.'); return; }
    apply(stale.map(function (rn) { return { op: { campaignLabelOperation: { remove: tagged[rn] } }, label: camps[rn].name + ': − etiqueta ' + LABEL + ' (ya estaba activa)' }; }));
    return;
  }

  if (wake.length && !brake) {
    var wr = apply(wake);
    // quitar la etiqueta solo a las que sí se reactivaron (y a las etiquetadas que ya estaban activas)
    var untag = [];
    Object.keys(tagged).forEach(function (rn) {
      var i = -1;
      wake.forEach(function (w, j) { if (w.rn === rn) i = j; });
      if (i < 0 ? status[rn] !== 'PAUSED' : (wr[i] && wr[i].ok)) untag.push({ op: { campaignLabelOperation: { remove: tagged[rn] } }, label: camps[rn].name + ': − etiqueta ' + LABEL });
    });
    apply(untag);
  } else if (brake) {
    if (wake.length) Logger.log('= El gasto de hoy ya superó el límite: no reactivo nada (' + wake.length + ' campaña(s) siguen pausadas).');
    // Campañas a frenar: las ENABLED de hoy
    var targets = Object.keys(camps).filter(function (rn) { return status[rn] === 'ENABLED'; });
    if (!targets.length) { Logger.log('Nada que cambiar (no hay campañas activas).'); return; }
    Logger.log('FRENO ACTIVADO: ' + mxn(cost) + ' ≥ ' + mxn(limit) + '. Pauso ' + targets.length + ' campaña(s) hasta mañana.');
    // a) etiqueta (crear si no existe) con la fecha de hoy
    if (!labelRn) {
      var lr = apply([{ op: { labelOperation: { create: { name: LABEL, textLabel: { description: today } } } }, label: '+ etiqueta ' + LABEL + ' (' + today + ')' }]);
      labelRn = lr[0] && lr[0].ok && !preview ? lr[0].rn : null;
      if (!labelRn) { Logger.log(preview ? 'VISTA PREVIA: la etiqueta nueva no tiene ID; en la corrida real se etiquetan y pausan: ' + targets.map(function (rn) { return camps[rn].name; }).join(', ') : 'No pude crear la etiqueta; NO pauso nada (sin etiqueta no sabría reactivarlas mañana).'); return; }
    } else if (labelDate !== today) {
      apply([{ op: { labelOperation: { update: { resourceName: labelRn, textLabel: { description: today } }, updateMask: 'text_label.description' } }, label: 'etiqueta ' + LABEL + ': fecha ' + (labelDate || '—') + ' -> ' + today }]);
    }
    // b) etiquetar las que no la tengan y c) pausar solo las etiquetadas
    var toTag = targets.filter(function (rn) { return !tagged[rn]; });
    var tr = apply(toTag.map(function (rn) { return { op: { campaignLabelOperation: { create: { campaign: rn, label: labelRn } } }, label: camps[rn].name + ': + etiqueta ' + LABEL }; }));
    var okTag = {};
    targets.forEach(function (rn) { if (tagged[rn]) okTag[rn] = true; });
    toTag.forEach(function (rn, i) { if (tr[i] && tr[i].ok) okTag[rn] = true; });
    apply(targets.filter(function (rn) { return okTag[rn]; }).map(function (rn) {
      return { op: { campaignOperation: { update: { resourceName: rn, status: 'PAUSED' }, updateMask: 'status' } }, label: camps[rn].name + ': ENABLED -> PAUSED (freno)' };
    }));
  }
  Logger.log(preview ? 'VISTA PREVIA: Google solo simuló los cambios; no se aplicó nada.' : 'Listo.');
}

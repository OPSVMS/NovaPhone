/**
 * NovaPhone — Google Ads: grupo "Sin registro" en "Nova | Search | eSIM México" (cuenta 823-438-8697, MXN).
 * Ver docs/ads/POLICY.md (regla del director) y docs/ads/novaphone-ads.js (lanzamiento; se corre ANTES que este).
 *
 * Qué hace (idempotente: la segunda corrida debe decir "Nada que cambiar"):
 *   1. Lista compartida "Nova | Negatives": agrega (frase) "mercado libre", "altan", "altán" y "telcel app" si faltan.
 *      No crea la lista ni la vincula: eso es de novaphone-ads.js (si no existe, ABORTA).
 *   2. En la campaña EXISTENTE "Nova | Search | eSIM México" crea, si falta, el grupo "Sin registro" (sin prefijo,
 *      como los demás grupos), sin puja propia (hereda Maximizar clics de la campaña), con sufijo de URL final
 *      utm_campaign=esim-mexico. Keywords en FRASE (búsquedas del autocompletado) + EXACTA (las 4 más fuertes).
 *      1 RSA con destino https://novaphone.lat/ (su FAQ da el estado legal real), ruta esim/mexico, descripción 1 fija.
 *      Si el grupo ya existe solo agrega lo que falte y corrige el sufijo; NUNCA cambia estados (si el director pausó
 *      el grupo, una keyword o el anuncio por §7 de POLICY.md, sigue pausado) y nunca borra nada.
 *
 * Política (POLICY.md §5): la intención "sin registro" se capta SOLO con keywords. Ningún título, descripción ni ruta
 * menciona el registro, CURP/INE, anonimato ni promete evitar nada; el script lo VERIFICA (FORBIDDEN, mismo filtro
 * que novaphone-ads.js) y ABORTA antes de tocar la cuenta si un texto lo viola, si un título pasa de 30 caracteres,
 * una descripción de 90, una ruta de 15, si la URL no es de https://novaphone.lat o si una negativa (nueva o ya en la
 * lista) bloquea una keyword Nova. "chip altan sin registro" NO se usa como keyword: no vendemos Altán y "altan" es negativa.
 *
 * Seguridad: assertSafe() revisa CADA operación: solo crea negativas de NEW_NEGATIVES en "Nova | Negatives", solo crea
 * el grupo "Sin registro" en esa campaña Nova, sus keywords (no negativas, del plan) y su RSA, y solo actualiza el
 * sufijo de ese grupo. Nada de Faro, de otras campañas ni de otros grupos.
 * Vista previa: Google simula (AdsApp.getExecutionInfo().isPreview()); el grupo, sus keywords y su anuncio van en un
 * solo lote con ID temporal, así que la Vista previa simula todo. DRY_RUN = true ni siquiera llama a mutateAll.
 * GAQL: todo campo del WHERE va también en el SELECT.
 *
 * Pegar en Google Ads → Herramientas → Acciones masivas → Secuencias de comandos → + → Autorizar → Vista previa → Ejecutar.
 */
var DRY_RUN = false;               // true = solo imprime el plan

var SITE = 'https://novaphone.lat';
var NOVA_RE = /^nova \| /i;
var CAMPAIGN = 'Nova | Search | eSIM México';
var NEG_LIST = 'Nova | Negatives';
var AD_GROUP = 'Sin registro';      // sin prefijo, como "eSIM México", "eSIM de datos" y "eSIM sin contrato"
var FINAL_URL = SITE + '/';         // la página con la pregunta frecuente legal (POLICY.md §6.2)
var PATH1 = 'esim';
var PATH2 = 'mexico';
// Mismo patrón que novaphone-ads.js; {keyword} es ValueTrack. Va en el GRUPO (prevalece sobre el de la campaña).
var URL_SUFFIX = 'utm_source=google&utm_medium=cpc&utm_campaign=esim-mexico&utm_term={keyword}';
var MAX_OPS = 1000;

// ----------------------------------------------------------------------------- Keywords
// Búsquedas del autocompletado de Google en México (16-oct-2026), en FRASE.
// Fuera: "chip altan sin registro" (no vendemos Altán; "altan" es negativa y la bloquearía).
var PHRASE_KEYWORDS = [
  'sim sin registro',
  'sim sin registro en mexico',
  'sim sin registro de curp',
  'e sim sin registro',
  'esim sin registro méxico',
  'e sim sin registro de curp',
  'chip sin registro telcel',
  'sim virtual sin registro',
  'chip sim sin registro',
  'sim internacional sin registro',
  'compañías telefónicas que no piden registro en méxico',
];
// Las 4 más fuertes, además en EXACTA.
var EXACT_KEYWORDS = [
  'esim sin registro',
  'sim sin registro',
  'sim sin registro en mexico',
  'esim sin registro mexico',
];

// ----------------------------------------------------------------------------- Anuncio (RSA)
// Títulos (≤ 30). Nada de registro/CURP/INE/"100 %": "Compra 100% en Línea" se cambió por "Compra Todo en Línea".
var HEADLINES = [
  'eSIM de Solo Datos para México',
  'Activa en 2 Minutos',
  'Sin Contrato ni Plazos',
  'Red Telcel 5G',
  'Desde $39 MXN',
  '20 GB por $599 MXN',
  'QR al Instante por Correo',
  'Paga con Tarjeta o SPEI',
  'Compra Todo en Línea',
  'Garantía de Conexión',
  'Sin Número ni Llamadas',
  'Recarga Cuando Quieras',
];
// Descripciones (≤ 90). La primera va fija en la posición 1.
var DESCRIPTIONS = [
  { text: 'eSIM de solo datos, sin número ni contrato. Instálala con un QR y navega en red Telcel 5G.', pin: 'DESCRIPTION_1' },
  { text: 'Paga con tarjeta o SPEI y recibe tu QR al instante. Garantía de conexión o devolución.' },
  { text: 'Planes desde 1 GB por $39 hasta 20 GB por $599 MXN. Recarga desde tu panel cuando quieras.' },
];

// ----------------------------------------------------------------------------- Negativas (frase) en "Nova | Negatives"
// "altán" va aparte: las negativas no cubren variantes con acento.
var NEW_NEGATIVES = ['mercado libre', 'altan', 'altán', 'telcel app'];

// Nada de esto puede aparecer en textos visibles (POLICY.md §5; mismo filtro que novaphone-ads.js).
var FORBIDDEN = /registr|curp|\bine\b|an[oó]nim|identific|document|papeleo|evita|evade|elud|esquiv|sin datos personales|rastre|sin rastro|privacidad total|100\s*%|ilimitad|gratis|!/i;

// =====================================================================================
function main() {
  var account = AdsApp.currentAccount();
  var preview = false;
  try { preview = AdsApp.getExecutionInfo().isPreview(); } catch (e) { preview = false; }
  var cid = String(account.getCustomerId()).replace(/-/g, '');
  log('='.repeat(78));
  log('NovaPhone | Google Ads | grupo "' + AD_GROUP + '" | ' +
    (preview ? 'VISTA PREVIA (no se guarda nada)' : DRY_RUN ? 'DRY_RUN (sin mutateAll)' : 'EJECUCIÓN (los cambios se guardan)') +
    ' | cuenta ' + account.getCustomerId());
  log('='.repeat(78));

  if (account.getCurrencyCode() !== 'MXN') { log('ABORTADO: la cuenta está en ' + account.getCurrencyCode() + '; se esperaba MXN.'); return; }
  var problems = validatePlan();
  if (problems.length) { abort(problems); return; }

  var ctx = { cid: cid, preview: preview, sent: 0, failed: 0, deferred: 0, warnings: [], tempSeq: 0,
    safe: { campaign: null, set: null, adGroup: null, temp: {} } };
  var S = readState(ctx);
  var pre = checkState(ctx, S);
  if (pre.length) { abort(pre); return; }
  printPlan(ctx, S);

  ensureNegatives(ctx, S);
  ensureAdGroup(ctx, S);
  summary(ctx);
}

// =====================================================================================
// Utilidades
// =====================================================================================
function log(s) { Logger.log(s); }
function abort(list) {
  list.forEach(function (p) { log('ABORTADO: ' + p); });
  log('No se tocó la cuenta.');
}
function len(s) { return Array.from ? Array.from(String(s)).length : String(s).length; }
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function isNova(n) { return NOVA_RE.test(String(n || '')); }
function kwKey(text, match) { return norm(text) + '|' + match; }
function isTemp(rn) { return typeof rn === 'string' && /\/-\d+$/.test(rn); }
function tempRn(ctx, coll) { ctx.tempSeq += 1; var rn = 'customers/' + ctx.cid + '/' + coll + '/-' + ctx.tempSeq; ctx.safe.temp[rn] = coll; return rn; }
function phraseBlocks(neg, kw) { return (' ' + norm(kw) + ' ').indexOf(' ' + norm(neg) + ' ') !== -1; }
function q(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function rows(query) {
  var out = [];
  var it = AdsApp.search(query);
  while (it.hasNext()) out.push(it.next());
  return out;
}
/** Keywords del plan: [{text, match}] (frase primero, luego exacta). */
function plannedKeywords() {
  return PHRASE_KEYWORDS.map(function (k) { return { text: k, match: 'PHRASE' }; })
    .concat(EXACT_KEYWORDS.map(function (k) { return { text: k, match: 'EXACT' }; }));
}

// =====================================================================================
// Validación del plan (antes de leer o tocar la cuenta)
// =====================================================================================
function validatePlan() {
  var p = [];
  if (!isNova(CAMPAIGN)) p.push('la campaña no es Nova: ' + CAMPAIGN);
  if (isNova(AD_GROUP)) p.push('el grupo va SIN prefijo "Nova | " (está dentro de una campaña Nova): ' + AD_GROUP);
  if (HEADLINES.length < 3 || HEADLINES.length > 15) p.push(HEADLINES.length + ' títulos (3–15)');
  var seen = {};
  HEADLINES.forEach(function (h) {
    if (len(h) > 30) p.push('título de ' + len(h) + ' caracteres (máx. 30): "' + h + '"');
    if (FORBIDDEN.test(h)) p.push('título prohibido por política: "' + h + '"');
    if (/\{/.test(h)) p.push('título con inserción dinámica (prohibida): "' + h + '"');
    if (seen[norm(h)]) p.push('título repetido: "' + h + '"');
    seen[norm(h)] = true;
  });
  if (DESCRIPTIONS.length < 2 || DESCRIPTIONS.length > 4) p.push(DESCRIPTIONS.length + ' descripciones (2–4)');
  DESCRIPTIONS.forEach(function (d, i) {
    if (len(d.text) > 90) p.push('descripción de ' + len(d.text) + ' caracteres (máx. 90): "' + d.text + '"');
    if (FORBIDDEN.test(d.text)) p.push('descripción prohibida por política: "' + d.text + '"');
    if (/\{/.test(d.text)) p.push('descripción con inserción dinámica (prohibida): "' + d.text + '"');
    if (d.pin && !(i === 0 && d.pin === 'DESCRIPTION_1')) p.push('solo la descripción 1 va fija (en DESCRIPTION_1)');
  });
  if (!DESCRIPTIONS[0] || DESCRIPTIONS[0].pin !== 'DESCRIPTION_1') p.push('la descripción 1 debe ir fija en la posición 1');
  if (len(PATH1) > 15 || len(PATH2) > 15) p.push('ruta visible de más de 15 caracteres');
  if (FORBIDDEN.test(PATH1 + ' ' + PATH2)) p.push('ruta visible prohibida por política');
  if (FINAL_URL.indexOf(SITE + '/') !== 0) p.push('URL fuera de ' + SITE + ': ' + FINAL_URL);
  if (!/utm_campaign=[a-z0-9-]+/.test(URL_SUFFIX) || URL_SUFFIX.indexOf('utm_term={keyword}') === -1) p.push('sufijo de URL sin utm_campaign o {keyword}');
  var kws = {};
  plannedKeywords().forEach(function (k) {
    if (len(k.text) > 80 || k.text.split(' ').length > 10) p.push('keyword demasiado larga: ' + k.text);
    if (/[!@%,*=^\[\]{}"+]/.test(k.text)) p.push('keyword con símbolo no permitido: ' + k.text);
    if (kws[kwKey(k.text, k.match)]) p.push('keyword repetida: ' + k.text + ' [' + k.match + ']');
    kws[kwKey(k.text, k.match)] = true;
    NEW_NEGATIVES.forEach(function (n) { if (phraseBlocks(n, k.text)) p.push('la negativa "' + n + '" bloquea la keyword "' + k.text + '"'); });
  });
  NEW_NEGATIVES.forEach(function (n) { if (/registr|curp/i.test(n)) p.push('"' + n + '": esa intención se capta, no se niega (POLICY.md §5.2)'); });
  return p;
}

// =====================================================================================
// Lecturas
// =====================================================================================
function readState(ctx) {
  var S = { campaign: null, adGroup: null, adGroupSuffix: '', adGroupStatus: null, kw: {}, ads: 0, novaKeywords: [],
    set: null, setCrit: {}, setLinked: false };

  rows("SELECT campaign.resource_name, campaign.name, campaign.status, campaign.advertising_channel_type, " +
    "campaign.bidding_strategy_type FROM campaign WHERE campaign.name = '" + q(CAMPAIGN) + "' AND campaign.status != 'REMOVED'").forEach(function (r) {
    var c = r.campaign;
    if (c.name !== CAMPAIGN || c.status === 'REMOVED' || S.campaign) return;
    S.campaign = { rn: c.resourceName, status: c.status, type: c.advertisingChannelType, bst: c.biddingStrategyType };
  });
  if (S.campaign) ctx.safe.campaign = S.campaign.rn;

  rows("SELECT ad_group.resource_name, ad_group.name, ad_group.status, ad_group.final_url_suffix, campaign.resource_name, campaign.name " +
    "FROM ad_group WHERE campaign.name = '" + q(CAMPAIGN) + "' AND ad_group.name = '" + q(AD_GROUP) + "' AND ad_group.status != 'REMOVED'").forEach(function (r) {
    if (!S.campaign || r.campaign.resourceName !== S.campaign.rn || r.adGroup.name !== AD_GROUP || r.adGroup.status === 'REMOVED' || S.adGroup) return;
    S.adGroup = r.adGroup.resourceName;
    S.adGroupStatus = r.adGroup.status;
    S.adGroupSuffix = r.adGroup.finalUrlSuffix || '';
  });
  if (S.adGroup) ctx.safe.adGroup = S.adGroup;

  // Keywords de TODAS las campañas Nova: para las del grupo, y para revisar duplicados y negativas que las bloqueen.
  rows("SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, " +
    "ad_group_criterion.type, ad_group_criterion.negative, ad_group.resource_name, ad_group.name, campaign.name, campaign.status " +
    "FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE " +
    "AND ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'").forEach(function (r) {
    var a = r.adGroupCriterion;
    if (!isNova(r.campaign.name) || a.negative || a.status === 'REMOVED' || !a.keyword) return;
    if (S.adGroup && r.adGroup.resourceName === S.adGroup) S.kw[kwKey(a.keyword.text, a.keyword.matchType)] = true;
    else S.novaKeywords.push({ text: a.keyword.text, match: a.keyword.matchType, where: r.campaign.name + ' > ' + r.adGroup.name });
  });

  if (S.adGroup) {
    rows("SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.type, ad_group.resource_name FROM ad_group_ad " +
      "WHERE ad_group.resource_name = '" + S.adGroup + "' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD' " +
      "AND ad_group_ad.status != 'REMOVED'").forEach(function (r) {
      if (r.adGroup.resourceName !== S.adGroup || r.adGroupAd.status === 'REMOVED') return;
      S.ads += 1;
    });
  }

  rows("SELECT shared_set.resource_name, shared_set.name, shared_set.status, shared_set.type FROM shared_set " +
    "WHERE shared_set.name = '" + q(NEG_LIST) + "' AND shared_set.status = 'ENABLED'").forEach(function (r) {
    if (r.sharedSet.name !== NEG_LIST || r.sharedSet.status !== 'ENABLED' || S.set) return;
    S.set = r.sharedSet.resourceName;
  });
  if (S.set) {
    ctx.safe.set = S.set;
    rows("SELECT shared_criterion.resource_name, shared_criterion.keyword.text, shared_criterion.keyword.match_type, " +
      "shared_set.resource_name, shared_set.name FROM shared_criterion WHERE shared_set.name = '" + q(NEG_LIST) + "'").forEach(function (r) {
      if (r.sharedSet.resourceName !== S.set || !r.sharedCriterion.keyword) return;
      S.setCrit[kwKey(r.sharedCriterion.keyword.text, r.sharedCriterion.keyword.matchType)] = r.sharedCriterion.keyword;
    });
    if (S.campaign) {
      rows("SELECT campaign_shared_set.resource_name, campaign_shared_set.status, campaign.resource_name, campaign.name, " +
        "shared_set.resource_name, shared_set.name FROM campaign_shared_set WHERE shared_set.name = '" + q(NEG_LIST) + "' " +
        "AND campaign.name = '" + q(CAMPAIGN) + "' AND campaign_shared_set.status != 'REMOVED'").forEach(function (r) {
        if (r.sharedSet.resourceName === S.set && r.campaign.resourceName === S.campaign.rn && r.campaignSharedSet.status !== 'REMOVED') S.setLinked = true;
      });
    }
  }
  return S;
}

/** Requisitos y choques con lo que ya está en la cuenta. Devuelve los motivos para abortar. */
function checkState(ctx, S) {
  var p = [];
  if (!S.campaign) p.push('no existe la campaña "' + CAMPAIGN + '". Corre primero novaphone-ads.js.');
  else if (S.campaign.type && S.campaign.type !== 'SEARCH') p.push('"' + CAMPAIGN + '" no es de Búsqueda (' + S.campaign.type + ').');
  if (!S.set) p.push('no existe la lista "' + NEG_LIST + '". Corre primero novaphone-ads.js.');
  if (p.length) return p;

  // Una negativa (ya en la lista o nueva) no puede bloquear una keyword Nova (la lista es de todas las campañas Nova).
  var negs = NEW_NEGATIVES.slice();
  Object.keys(S.setCrit).forEach(function (k) { negs.push(S.setCrit[k].text); });
  var mine = plannedKeywords().map(function (k) { return { text: k.text, where: AD_GROUP }; });
  mine.concat(S.novaKeywords).forEach(function (k) {
    negs.forEach(function (n) {
      if (phraseBlocks(n, k.text)) p.push('la negativa "' + n + '" bloquearía la keyword "' + k.text + '" (' + k.where + ')');
    });
  });
  // Duplicados con otros grupos Nova: se crean igual (decisión del director) pero se avisa.
  plannedKeywords().forEach(function (k) {
    S.novaKeywords.forEach(function (o) {
      if (norm(o.text) === norm(k.text) && o.match === k.match) {
        ctx.warnings.push('"' + k.text + '" [' + k.match + '] ya existe en ' + o.where + '. Dos keywords idénticas en la misma ' +
          'campaña compiten entre sí; si el director lo prefiere, pausa una de las dos a mano.');
      }
    });
  });
  if (!S.setLinked) ctx.warnings.push('"' + NEG_LIST + '" no está vinculada a "' + CAMPAIGN + '": corre novaphone-ads.js para vincularla.');
  if (S.campaign.status !== 'ENABLED') ctx.warnings.push('"' + CAMPAIGN + '" está ' + S.campaign.status + ': el grupo no servirá hasta que la campaña esté activa.');
  if (S.adGroup && S.adGroupStatus !== 'ENABLED') ctx.warnings.push('el grupo "' + AD_GROUP + '" está ' + S.adGroupStatus + '; este script no lo reactiva (POLICY.md §7).');
  return p;
}

function printPlan(ctx, S) {
  var kws = plannedKeywords();
  log('PLAN · ' + CAMPAIGN + ' (' + S.campaign.status + ', puja ' + (S.campaign.bst || '?') + ', el grupo la hereda) > grupo "' + AD_GROUP + '"' +
    (S.adGroup ? ' (existe, ' + S.adGroupStatus + ')' : ' (nuevo)'));
  log('  ' + PHRASE_KEYWORDS.length + ' keywords en frase + ' + EXACT_KEYWORDS.length + ' en exacta = ' + kws.length + ' · 1 RSA (' +
    HEADLINES.length + ' títulos, ' + DESCRIPTIONS.length + ' descripciones) -> ' + FINAL_URL + ' · ruta ' + PATH1 + '/' + PATH2);
  log('  sufijo del grupo: ' + URL_SUFFIX);
  log('  negativas nuevas en "' + NEG_LIST + '" (frase): ' + NEW_NEGATIVES.join(', '));
  log('');
}

// =====================================================================================
// Seguridad: cada operación se revisa antes de mandarse
// =====================================================================================
function assertSafe(ctx, o) {
  var t = Object.keys(o)[0], b = o[t], s = ctx.safe, c = b.create, u = b.update;
  function ourGroup(rn) { return !!rn && (rn === s.adGroup || (isTemp(rn) && s.temp[rn] === 'adGroups')); }
  var ok = false;
  if (b.remove) {
    ok = false;
  } else if (u) {
    ok = t === 'adGroupOperation' && !!s.adGroup && u.resourceName === s.adGroup && b.updateMask === 'final_url_suffix' &&
      u.finalUrlSuffix === URL_SUFFIX && Object.keys(u).length === 2;
  } else if (c) {
    if (t === 'sharedCriterionOperation') ok = !!s.set && c.sharedSet === s.set && c.keyword && c.keyword.matchType === 'PHRASE' &&
      NEW_NEGATIVES.indexOf(c.keyword.text) !== -1;
    else if (t === 'adGroupOperation') ok = !!s.campaign && c.campaign === s.campaign && c.name === AD_GROUP && isTemp(c.resourceName) &&
      s.temp[c.resourceName] === 'adGroups' && c.cpcBidMicros == null;
    else if (t === 'adGroupCriterionOperation') ok = ourGroup(c.adGroup) && !c.negative && !!c.keyword &&
      plannedKeywords().some(function (k) { return k.text === c.keyword.text && k.match === c.keyword.matchType; });
    else if (t === 'adGroupAdOperation') ok = ourGroup(c.adGroup) && c.ad && c.ad.finalUrls.length === 1 && c.ad.finalUrls[0] === FINAL_URL &&
      !!c.ad.responsiveSearchAd;
  }
  if (!ok) throw new Error('SEGURIDAD: operación bloqueada (fuera del grupo "' + AD_GROUP + '" / "' + NEG_LIST + '"): ' + JSON.stringify(o).slice(0, 400));
}

/** Manda operaciones. atomic = todo-o-nada (necesario con IDs temporales). Devuelve [{ok}] paralelo a items. */
function send(ctx, label, items, atomic) {
  if (!items.length) return [];
  items.forEach(function (x) { assertSafe(ctx, x.op); });
  if (DRY_RUN) {
    log('  [dry run] ' + label + ': ' + items.length + ' operaciones');
    items.forEach(function (x) { log('    (dry run) ' + x.desc); });
    ctx.sent += items.length;
    return items.map(function () { return { ok: false, rn: null }; });
  }
  if (items.length > MAX_OPS) throw new Error('Lote "' + label + '" con ' + items.length + ' operaciones (máx. ' + MAX_OPS + ')');
  var res;
  try {
    res = AdsApp.mutateAll(items.map(function (x) { return x.op; }), { partialFailure: !atomic });
  } catch (e) {
    log('  ✗ ' + label + ': mutateAll falló: ' + (e.message || e));
    ctx.failed += items.length;
    return items.map(function () { return { ok: false, rn: null }; });
  }
  var anyBad = res.some(function (r) { return !r.isSuccessful(); });
  var good = 0;
  var out = res.map(function (r, j) {
    var okOne = r.isSuccessful() && !(atomic && anyBad);
    var body = items[j].op[Object.keys(items[j].op)[0]];
    var rn = null;
    if (okOne && !(ctx.preview && body.create)) { try { rn = r.getResourceName(); } catch (e) { rn = null; } }
    if (okOne) good++;
    else if (!r.isSuccessful()) log('    FAIL ' + items[j].desc + ' :: ' + (r.getErrorMessages() || []).join(' | '));
    return { ok: okOne, rn: rn };
  });
  ctx.sent += good;
  ctx.failed += items.length - good;
  if (anyBad && atomic) log('  ✗ ' + label + ': lote revertido (' + items.length + ' operaciones, todo-o-nada)');
  else log('  ' + (anyBad ? '~ ' : '✓ ') + label + ': ' + good + '/' + items.length + ' operaciones' + (ctx.preview ? ' (simuladas)' : ''));
  items.forEach(function (x, j) { if (out[j].ok) log('      ' + x.desc); });
  return out;
}

// =====================================================================================
// 1. Negativas
// =====================================================================================
function ensureNegatives(ctx, S) {
  log('[1] Negativas en "' + NEG_LIST + '"');
  var items = [];
  NEW_NEGATIVES.forEach(function (n) {
    if (S.setCrit[kwKey(n, 'PHRASE')]) return;
    items.push({ op: { sharedCriterionOperation: { create: { sharedSet: S.set, keyword: { text: n, matchType: 'PHRASE' } } } }, desc: '+ negativa "' + n + '" [frase]' });
  });
  if (!items.length) { log('  = al día (' + NEW_NEGATIVES.join(', ') + ')'); return; }
  send(ctx, NEG_LIST, items, false);
}

// =====================================================================================
// 2. Grupo "Sin registro": keywords + RSA
// =====================================================================================
function rsaOp(agRn) {
  var rsa = {
    headlines: HEADLINES.map(function (h) { return { text: h }; }),
    descriptions: DESCRIPTIONS.map(function (d) { return d.pin ? { text: d.text, pinnedField: d.pin } : { text: d.text }; }),
    path1: PATH1,
    path2: PATH2,
  };
  return { op: { adGroupAdOperation: { create: { adGroup: agRn, status: 'ENABLED', ad: { finalUrls: [FINAL_URL], responsiveSearchAd: rsa } } } },
    desc: AD_GROUP + ': + RSA -> ' + FINAL_URL + ' (' + PATH1 + '/' + PATH2 + ')', ad: true };
}

function ensureAdGroup(ctx, S) {
  log('[2] ' + CAMPAIGN + ' > ' + AD_GROUP);
  var agRn = S.adGroup, chain = [], fresh = !agRn;
  if (fresh) {
    agRn = tempRn(ctx, 'adGroups');
    // Sin cpcBidMicros: la campaña usa Maximizar clics (con tope) y el grupo hereda esa puja.
    chain.push({ op: { adGroupOperation: { create: { resourceName: agRn, campaign: S.campaign.rn, name: AD_GROUP, status: 'ENABLED',
      type: 'SEARCH_STANDARD', finalUrlSuffix: URL_SUFFIX } } }, desc: '+ grupo ' + AD_GROUP + ' (puja heredada de la campaña, sufijo esim-mexico)' });
  } else if (S.adGroupSuffix !== URL_SUFFIX) {
    send(ctx, AD_GROUP + ': sufijo', [{ op: { adGroupOperation: { update: { resourceName: agRn, finalUrlSuffix: URL_SUFFIX }, updateMask: 'final_url_suffix' } },
      desc: AD_GROUP + ': sufijo "' + S.adGroupSuffix + '" -> "' + URL_SUFFIX + '"' }], false);
  }
  plannedKeywords().forEach(function (k) {
    if (!fresh && S.kw[kwKey(k.text, k.match)]) return;
    chain.push({ op: { adGroupCriterionOperation: { create: { adGroup: agRn, status: 'ENABLED', keyword: { text: k.text, matchType: k.match } } } },
      desc: AD_GROUP + ': + "' + k.text + '" [' + k.match + ']' });
  });
  if (fresh || !S.ads) chain.push(rsaOp(agRn));
  if (!chain.length) { log('  = grupo, keywords y anuncio al día'); return; }

  var label = AD_GROUP + ': ' + (fresh ? 'grupo + keywords + anuncio' : 'keywords/anuncio que faltaban');
  var r = send(ctx, label, chain, fresh);
  if (DRY_RUN) return;
  var bad = r.some(function (x) { return !x.ok; });
  if (!bad) return;
  if (!fresh) { // lote no atómico: lo demás quedó; cada FAIL ya está en el registro
    ctx.warnings.push('Algo de "' + AD_GROUP + '" fue rechazado (ver FAIL). No se reescribe "para que pase" (POLICY.md §7): manda la captura al director.');
    return;
  }

  // Grupo nuevo y el lote se revirtió: si fue por el anuncio, se crea sin anuncio y el anuncio va solo.
  log('  ↻ reintento sin anuncio y luego el anuncio por separado');
  ctx.failed -= chain.length;
  var noAd = chain.filter(function (x) { return !x.ad; });
  var r2 = send(ctx, AD_GROUP + ' (sin anuncio)', noAd, true);
  if (!r2.length || !r2.every(function (x) { return x.ok; })) {
    ctx.warnings.push('No se pudo crear el grupo "' + AD_GROUP + '" (ver FAIL arriba). Manda el registro al director.');
    return;
  }
  var realRn = r2[0].rn;
  if (!realRn) { ctx.deferred += 1; log('    - anuncio diferido (grupo sin ID' + (ctx.preview ? ' en Vista previa' : '') + ')'); return; }
  ctx.safe.adGroup = realRn;
  var res = send(ctx, AD_GROUP + ': anuncio', [rsaOp(realRn)], true);
  if (!(res[0] && res[0].ok)) ctx.warnings.push('El anuncio de "' + AD_GROUP + '" fue rechazado (ver FAIL). No se reescribe "para que pase" (POLICY.md §7): manda la captura al director.');
}

// =====================================================================================
function summary(ctx) {
  log('');
  log('='.repeat(78));
  if (ctx.warnings.length) { log('AVISOS (' + ctx.warnings.length + '):'); ctx.warnings.forEach(function (w) { log('  ! ' + w); }); }
  log('Operaciones: ' + ctx.sent + ' ' + (DRY_RUN ? 'planeadas' : ctx.preview ? 'simuladas' : 'aplicadas') + ' · ' + ctx.failed + ' fallidas · ' +
    ctx.deferred + ' diferidas');
  if (!ctx.sent && !ctx.failed && !ctx.deferred) log('Nada que cambiar: la cuenta ya coincide con el plan.');
  else if (ctx.preview) log('VISTA PREVIA: Google solo simuló los cambios; no se aplicó nada. Si no hay FAIL ni ABORTADO, dale Ejecutar.');
  else if (DRY_RUN) log('DRY_RUN: no se aplicó nada.');
  else if (ctx.failed) log('TERMINÓ CON ERRORES: copia todo el registro y mándalo al director. Volver a correrlo es seguro.');
  else log('Listo. Vuelve a correr la Vista previa: debe decir "Nada que cambiar".');
  log('='.repeat(78));
}

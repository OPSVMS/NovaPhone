/**
 * NovaPhone — Google Ads: lanzamiento de Búsqueda en México (cuenta 823-438-8697, MXN). Ver docs/ads/PLAN.md y POLICY.md.
 *
 * Qué hace (idempotente: la segunda corrida debe decir "Nada que cambiar"):
 *   1. PAUSA todas las campañas cuyo nombre empieza con "Faro | " y les quita la etiqueta "Faro|freno" (si el freno de
 *      Faro sigue programado, ya no puede reactivarlas al día siguiente). Solo cambia el estado; nada más de Faro.
 *   2. Conversión: si no existe "Compra" y existe "Compra Faro", la RENOMBRA a "Compra" (cubre ambas marcas; la etiqueta
 *      send_to no cambia). Crea el objetivo personalizado "Nova | Compra" y lo asigna a las campañas Nova.
 *   3. Lista compartida de negativas "Nova | Negatives" (frase). No se niega "registro": esa intención se captura.
 *   4. Assets "Nova | …": 4 sitelinks (Planes, Cómo funciona, Compatibilidad, Preguntas) y callouts.
 *   5. Campañas "Nova | Search | …" (solo Búsqueda en Google, sin socios ni Display), Maximizar clics con tope de CPC
 *      MXN 10, presupuesto por FASE, sufijo de URL final con UTM. Grupos, keywords (frase + exacta) y 1 RSA por grupo.
 *      Se crean PAUSADAS; México (geoTargetConstants/2484, opción Presencia) y español (languageConstants/1003) se
 *      agregan en un segundo lote con el resource name REAL de la campaña; SOLO si ambos quedaron puestos se ACTIVAN.
 *      Una campaña Nova nunca se activa sin México (sin ubicaciones = todo el mundo).
 *   6. Imprime el send_to (AW-…/etiqueta) para las variables de entorno de novaphone.lat.
 *
 * FASE (cambia PHASE cuando el director lo indique y vuelve a correr: solo cambian presupuestos):
 *   FASE 1 = MXN 150/día: eSIM México 90 · Telcel/Chip virtual 40 · Brand 20
 *   FASE 2 = MXN 280/día: eSIM México 170 · Telcel/Chip virtual 80 · Brand 30
 *   FASE 3 = MXN 330/día: eSIM México 200 · Telcel/Chip virtual 95 · Brand 35
 *
 * Políticas (POLICY.md): ningún texto de anuncio, sitelink o callout puede prometer evitar el registro de líneas ni
 * mencionar CURP/INE/registro/anonimato. El script lo VERIFICA y ABORTA antes de tocar la cuenta si algún texto lo hace,
 * si algún título pasa de 30 caracteres, una descripción de 90, una ruta de 15, un sitelink de 25/35, un callout de 25,
 * si una URL no es de https://novaphone.lat o si una negativa bloquea una keyword propia.
 *
 * Seguridad: assertSafe() revisa CADA operación antes de mutar. Solo crea entidades "Nova | …" (más sus grupos,
 * keywords y anuncios), solo actualiza campañas/presupuestos Nova, solo cambia a PAUSED el estado de campañas Faro,
 * solo quita vínculos de la etiqueta "Faro|freno" y solo renombra "Compra Faro" -> "Compra". Nunca borra nada más.
 * Vista previa: Google simula (AdsApp.getExecutionInfo().isPreview()); lo que depende de IDs nuevos queda "diferido".
 * DRY_RUN = true ni siquiera llama a mutateAll. GAQL: todo campo del WHERE va también en el SELECT.
 *
 * Pegar en Google Ads → Herramientas → Acciones masivas → Secuencias de comandos → + → Autorizar → Vista previa → Ejecutar.
 */
var PHASE = 1;                     // 1 = MXN 150/día · 2 = MXN 280/día · 3 = MXN 330/día (lo indica el director)
var DRY_RUN = false;               // true = solo imprime el plan

var SITE = 'https://novaphone.lat';
var NOVA_RE = /^nova \| /i;
var FARO_RE = /^faro \| /i;
var NEG_LIST = 'Nova | Negatives';
var NOVA_FRENO = 'Nova|freno';     // etiqueta del freno horario de Nova (novaphone-freno.js)
var FARO_FRENO = 'Faro|freno';     // etiqueta del freno de Faro: se quita de las campañas Faro
var MEXICO = 'geoTargetConstants/2484';
var SPANISH = 'languageConstants/1003';
var CPC_CAP_MXN = 10;
// {keyword} es ValueTrack. Google no tiene un ValueTrack con el NOMBRE de la campaña, así que utm_campaign es fijo por campaña.
var URL_SUFFIX = 'utm_source=google&utm_medium=cpc&utm_campaign=%SLUG%&utm_term={keyword}';
var CONVERSION_NAME = 'Compra';
var CONVERSION_OLD_NAME = 'Compra Faro';
var RENAME_CONVERSION = true;      // false = deja "Compra Faro" con su nombre y la usa igual
var CUSTOM_GOAL = 'Nova | Compra';
var MAX_OPS = 1000;
var SWITCHABLE = ['MANUAL_CPC', 'TARGET_SPEND', 'ENHANCED_CPC', 'MANUAL_CPM'];

// Presupuesto diario (MXN) por fase y campaña (clave = CAMPAIGNS[i].key).
var PHASES = {
  1: { total: 150, budgets: { esim: 90, telcel: 40, brand: 20 } },
  2: { total: 280, budgets: { esim: 170, telcel: 80, brand: 30 } },
  3: { total: 330, budgets: { esim: 200, telcel: 95, brand: 35 } },
};

// ----------------------------------------------------------------------------- Anuncios (RSA)
// Títulos comunes (≤ 30). Cada grupo antepone los suyos; se usan los primeros 15 sin repetir.
var COMMON_HEADLINES = [
  'eSIM de datos para México',
  'Activa en 2 minutos',
  'Sin contrato ni plazos',
  'Red Telcel 5G',
  '20 GB por $599',
  'Paga con tarjeta o SPEI',
  'QR al instante por correo',
  'Garantía de conexión',
  'Recarga la misma eSIM',
  'Sin chip físico',
  'Planes de 1 GB a 50 GB',
  'Compra en línea hoy',
  'eSIM para celular y tablet',
  'NovaPhone eSIM México',
];
// Descripciones (≤ 90). La primera va fija en la posición 1.
var DESCRIPTIONS = [
  { text: 'Solo datos, sin número: internet móvil en red Telcel 5G. Instálala con un QR en minutos.', pin: 'DESCRIPTION_1' },
  { text: 'Planes de 1 GB a 50 GB. 20 GB por 30 días a $599. Paga con tarjeta o SPEI.' },
  { text: 'Sin contrato ni plazos. Recarga la misma eSIM desde tu panel cuando la necesites.' },
  { text: 'Revisa si tu teléfono tiene eSIM antes de comprar. Garantía de conexión.' },
];

// ----------------------------------------------------------------------------- Campañas
var CAMPAIGNS = [
  { key: 'esim', name: 'Nova | Search | eSIM México', slug: 'nova-esim-mexico', enabled: true, adGroups: [
    { name: 'eSIM México', url: SITE + '/planes', path1: 'esim', path2: 'mexico',
      headlines: ['eSIM México desde $39'],
      keywords: ['esim mexico', 'esim en mexico', 'comprar esim mexico', 'esim prepago mexico'] },
    { name: 'eSIM de datos', url: SITE + '/planes', path1: 'esim', path2: 'datos',
      headlines: ['eSIM solo datos', 'Internet prepago sin chip'],
      keywords: ['esim de datos', 'esim solo datos', 'esim para tablet', 'internet para celular prepago'] },
    // Captura la intención "sin registro": el anuncio NO la repite ni promete nada sobre el registro (POLICY.md §4).
    { name: 'eSIM sin contrato', url: SITE + '/', path1: 'esim', path2: 'sin-contrato',
      headlines: ['eSIM sin contrato'],
      keywords: ['esim sin registro', 'esim sin contrato'] },
  ] },
  { key: 'telcel', name: 'Nova | Search | Telcel/Chip virtual', slug: 'nova-telcel-chip-virtual', enabled: true, adGroups: [
    { name: 'eSIM Telcel', url: SITE + '/', path1: 'esim', path2: 'telcel-5g',
      headlines: ['eSIM de datos red Telcel 5G'],
      keywords: ['esim telcel'] },
    { name: 'Chip virtual', url: SITE + '/', path1: 'chip-virtual', path2: 'mexico',
      headlines: ['Chip virtual de datos', 'Chip virtual en México'],
      keywords: ['chip virtual mexico', 'chip virtual telcel'] },
  ] },
  { key: 'brand', name: 'Nova | Search | Brand', slug: 'nova-brand', enabled: true, adGroups: [
    { name: 'NovaPhone', url: SITE + '/', path1: 'esim', path2: '',
      headlines: ['NovaPhone: sitio oficial'],
      keywords: ['novaphone', 'nova phone', 'novaphone esim'] },
  ] },
];
var MATCH_TYPES = ['PHRASE', 'EXACT'];

// ----------------------------------------------------------------------------- Negativas (frase), lista compartida
var NEGATIVES = [
  'gratis', 'free', 'hack', 'clonar', 'personal', 'activar',
  'como registrar', 'registrar mi', 'registro de telefonia', 'ift', 'crt', 'ley', 'multa', 'imei', 'liberar', 'desbloquear',
  'telcel app', 'mi telcel', 'recarga telcel', 'saldo telcel', 'amigo sin limite', 'iphone precio', 'plan tarifario',
  'pospago', 'factura',
];

// ----------------------------------------------------------------------------- Assets (sitelinks ≤ 25 / 35, callouts ≤ 25)
var SITELINKS = [
  { linkText: 'Planes', description1: 'De 1 GB a 50 GB, sin contrato', description2: '20 GB por 30 días a $599', url: SITE + '/planes' },
  { linkText: 'Cómo funciona', description1: 'Compra, escanea el QR y navega', description2: 'Lista en unos minutos', url: SITE + '/#como-funciona' },
  { linkText: 'Compatibilidad', description1: 'Revisa si tu equipo tiene eSIM', description2: 'iPhone, Samsung, Pixel y más', url: SITE + '/#compatibilidad' },
  { linkText: 'Preguntas', description1: 'Red, vigencia, pagos y recargas', description2: 'Resolvemos tus dudas', url: SITE + '/#preguntas' },
];
var CALLOUTS = ['Sin contrato', 'Red Telcel 5G', 'QR al instante', 'Paga con tarjeta o SPEI', 'Garantía de conexión',
  'Recargas desde tu panel', 'Solo datos, sin número'];

// Nada de esto puede aparecer en textos de anuncio, sitelinks o callouts (POLICY.md §5).
var FORBIDDEN = /registr|curp|\bine\b|an[oó]nim|identific|document|papeleo|evita|evade|elud|esquiv|sin datos personales|rastre|sin rastro|privacidad total|100\s*%|ilimitad|gratis|!/i;

// =====================================================================================
function main() {
  var account = AdsApp.currentAccount();
  var preview = false;
  try { preview = AdsApp.getExecutionInfo().isPreview(); } catch (e) { preview = false; }
  var cid = String(account.getCustomerId()).replace(/-/g, '');
  log('='.repeat(78));
  log('NovaPhone | Google Ads | ' + (preview ? 'VISTA PREVIA (no se guarda nada)' : DRY_RUN ? 'DRY_RUN (sin mutateAll)' : 'EJECUCIÓN (los cambios se guardan)') +
    ' | cuenta ' + account.getCustomerId());
  log('='.repeat(78));

  if (account.getCurrencyCode() !== 'MXN') { log('ABORTADO: la cuenta está en ' + account.getCurrencyCode() + '; los montos son MXN.'); return; }
  var problems = validatePlan();
  if (problems.length) {
    problems.forEach(function (p) { log('ABORTADO: ' + p); });
    log('No se tocó la cuenta. Corrige el script y vuelve a correrlo.');
    return;
  }
  var phase = PHASES[PHASE];

  var ctx = { cid: cid, preview: preview, sent: 0, deferred: 0, failed: 0, warnings: [], manual: [],
    safe: { faroCampaign: {}, novaCampaign: {}, novaBudget: {}, novaAdGroup: {}, novaSharedSet: {}, novaAsset: {},
      faroFrenoLink: {}, conversionRename: null, temp: {} }, tempSeq: 0 };
  var S = readState(ctx);
  printPlan(ctx, S, phase);

  pauseFaro(ctx, S);
  var action = ensureConversion(ctx, S);
  var setRn = ensureNegatives(ctx, S);
  var assetRn = ensureAssets(ctx, S);
  var real = {}; // plan key -> real campaign rn (null if not available)
  CAMPAIGNS.forEach(function (c) { real[c.key] = ensureCampaign(ctx, S, c, phase); });
  var targeted = ensureTargeting(ctx, S, real);
  ensureLinks(ctx, S, real, setRn, assetRn);
  ensureStatus(ctx, S, real, targeted);
  ensureGoal(ctx, S, real, action);
  reportSendTo(ctx, action);
  summary(ctx);
}

// =====================================================================================
// Utilidades
// =====================================================================================
function log(s) { Logger.log(s); }
function len(s) { return Array.from ? Array.from(String(s)).length : String(s).length; }
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
function micros(mxn) { return String(Math.round(mxn * 100) * 10000); }
function mxn(m) { return m == null ? '—' : 'MXN ' + (Number(m) / 1e6).toFixed(2); }
function isFaro(n) { return FARO_RE.test(String(n || '')); }
function isNova(n) { return NOVA_RE.test(String(n || '')); }
function kwKey(text, match) { return norm(text) + '|' + match; }
function isTemp(rn) { return typeof rn === 'string' && /\/-\d+$/.test(rn); }
function tempRn(ctx, coll) { ctx.tempSeq += 1; var rn = 'customers/' + ctx.cid + '/' + coll + '/-' + ctx.tempSeq; ctx.safe.temp[rn] = coll; return rn; }
function suffixFor(c) { return URL_SUFFIX.replace('%SLUG%', c.slug); }
function rows(query, optional) {
  var out = [];
  try {
    var it = AdsApp.search(query);
    while (it.hasNext()) out.push(it.next());
  } catch (e) {
    if (optional) { log('  (aviso) consulta fallida, sigo: ' + (e.message || e)); return null; }
    throw e;
  }
  return out;
}
function headlinesFor(ag) {
  var seen = {}, out = [];
  ag.headlines.concat(COMMON_HEADLINES).forEach(function (h) {
    if (out.length >= 15 || seen[norm(h)]) return;
    seen[norm(h)] = true;
    out.push(h);
  });
  return out;
}
function phraseBlocks(neg, kw) { return (' ' + norm(kw) + ' ').indexOf(' ' + norm(neg) + ' ') !== -1; }

// =====================================================================================
// Validación del plan (antes de tocar la cuenta)
// =====================================================================================
function validatePlan() {
  var p = [];
  var phase = PHASES[PHASE];
  if (!phase) return ['PHASE debe ser 1, 2 o 3 (está en ' + PHASE + ').'];
  var sum = 0;
  CAMPAIGNS.forEach(function (c) {
    var b = phase.budgets[c.key];
    if (!isNova(c.name)) p.push('campaña sin prefijo "Nova | ": ' + c.name);
    if (c.enabled && !(b > 0)) p.push(c.name + ' sin presupuesto en la fase ' + PHASE);
    if (c.enabled) sum += b;
    c.adGroups.forEach(function (ag) {
      var where = c.name + ' > ' + ag.name;
      var hs = headlinesFor(ag);
      if (hs.length < 3 || hs.length > 15) p.push(where + ': ' + hs.length + ' títulos (3–15)');
      hs.forEach(function (h) {
        if (len(h) > 30) p.push(where + ': título de ' + len(h) + ' caracteres (máx. 30): "' + h + '"');
        if (FORBIDDEN.test(h)) p.push(where + ': título prohibido por política: "' + h + '"');
      });
      if (DESCRIPTIONS.length < 2 || DESCRIPTIONS.length > 4) p.push('se necesitan 2–4 descripciones');
      DESCRIPTIONS.forEach(function (d) {
        if (len(d.text) > 90) p.push('descripción de ' + len(d.text) + ' caracteres (máx. 90): "' + d.text + '"');
        if (FORBIDDEN.test(d.text)) p.push('descripción prohibida por política: "' + d.text + '"');
      });
      if (len(ag.path1 || '') > 15 || len(ag.path2 || '') > 15) p.push(where + ': ruta visible de más de 15 caracteres');
      if (FORBIDDEN.test((ag.path1 || '') + ' ' + (ag.path2 || ''))) p.push(where + ': ruta visible prohibida');
      if (ag.url.indexOf(SITE + '/') !== 0) p.push(where + ': URL fuera de ' + SITE + ': ' + ag.url);
      ag.keywords.forEach(function (k) {
        if (len(k) > 80 || k.split(' ').length > 10) p.push(where + ': keyword demasiado larga: ' + k);
        NEGATIVES.forEach(function (n) { if (phraseBlocks(n, k)) p.push('la negativa "' + n + '" bloquea la keyword "' + k + '"'); });
      });
    });
  });
  if (sum !== phase.total) p.push('los presupuestos de la fase ' + PHASE + ' suman MXN ' + sum + ' y el total es ' + phase.total);
  SITELINKS.forEach(function (s) {
    if (len(s.linkText) > 25 || len(s.description1) > 35 || len(s.description2) > 35) p.push('sitelink demasiado largo: ' + s.linkText);
    if (FORBIDDEN.test(s.linkText + ' ' + s.description1 + ' ' + s.description2)) p.push('sitelink prohibido por política: ' + s.linkText);
    if (s.url.indexOf(SITE + '/') !== 0) p.push('sitelink fuera de ' + SITE + ': ' + s.url);
  });
  CALLOUTS.forEach(function (t) {
    if (len(t) > 25) p.push('callout de más de 25 caracteres: ' + t);
    if (FORBIDDEN.test(t)) p.push('callout prohibido por política: ' + t);
  });
  if (PHASES[PHASE].total > 330) p.push('el tope del plan es MXN 330/día');
  return p;
}

// =====================================================================================
// Lecturas
// =====================================================================================
function readState(ctx) {
  var S = { faro: [], nova: {}, labels: [], adGroups: {}, keywords: {}, ads: {}, geo: {}, lang: {}, otherGeo: {},
    set: null, setCrit: {}, setLinked: {}, assets: {}, assetLinks: {}, conv: {} };

  rows("SELECT campaign.resource_name, campaign.name, campaign.status, campaign.advertising_channel_type, " +
    "campaign.bidding_strategy_type, campaign.bidding_strategy, campaign.target_spend.cpc_bid_ceiling_micros, " +
    "campaign.geo_target_type_setting.positive_geo_target_type, campaign.network_settings.target_google_search, " +
    "campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, " +
    "campaign.final_url_suffix, campaign_budget.resource_name, campaign_budget.amount_micros, " +
    "campaign_budget.explicitly_shared FROM campaign WHERE campaign.status != 'REMOVED'").forEach(function (r) {
    var c = r.campaign;
    if (c.status === 'REMOVED') return;
    if (isFaro(c.name)) {
      S.faro.push({ rn: c.resourceName, name: c.name, status: c.status });
      ctx.safe.faroCampaign[c.resourceName] = true;
    } else if (isNova(c.name)) {
      var b = r.campaignBudget || {};
      S.nova[norm(c.name)] = { rn: c.resourceName, name: c.name, status: c.status, type: c.advertisingChannelType,
        bst: c.biddingStrategyType, portfolio: c.biddingStrategy || null, ceiling: c.targetSpend ? c.targetSpend.cpcBidCeilingMicros : null,
        geoType: c.geoTargetTypeSetting ? c.geoTargetTypeSetting.positiveGeoTargetType : null, net: c.networkSettings || {},
        suffix: c.finalUrlSuffix || '', budgetRn: b.resourceName, budget: b.amountMicros, sharedBudget: !!b.explicitlyShared };
      ctx.safe.novaCampaign[c.resourceName] = true;
      if (b.resourceName && !b.explicitlyShared) ctx.safe.novaBudget[b.resourceName] = true;
    }
  });

  rows("SELECT campaign_label.resource_name, campaign.resource_name, campaign.name, label.resource_name, label.name " +
    "FROM campaign_label WHERE label.name IN ('" + FARO_FRENO + "', '" + NOVA_FRENO + "')").forEach(function (r) {
    if (!r.label || (r.label.name !== FARO_FRENO && r.label.name !== NOVA_FRENO)) return;
    S.labels.push({ rn: r.campaignLabel.resourceName, campaign: r.campaign.resourceName, campaignName: r.campaign.name, label: r.label.name });
  });

  rows("SELECT ad_group.resource_name, ad_group.name, ad_group.status, campaign.resource_name, campaign.name, campaign.status " +
    "FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'").forEach(function (r) {
    if (!isNova(r.campaign.name) || r.adGroup.status === 'REMOVED') return;
    S.adGroups[norm(r.campaign.name) + '||' + norm(r.adGroup.name)] = r.adGroup.resourceName;
    ctx.safe.novaAdGroup[r.adGroup.resourceName] = true;
  });

  rows("SELECT ad_group_criterion.resource_name, ad_group_criterion.status, ad_group_criterion.type, ad_group_criterion.negative, " +
    "ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group.resource_name, campaign.name, campaign.status " +
    "FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.negative = FALSE " +
    "AND ad_group_criterion.status != 'REMOVED' AND campaign.status != 'REMOVED'").forEach(function (r) {
    var a = r.adGroupCriterion;
    if (!isNova(r.campaign.name) || a.negative || a.status === 'REMOVED' || !a.keyword) return;
    var g = r.adGroup.resourceName;
    (S.keywords[g] = S.keywords[g] || {})[kwKey(a.keyword.text, a.keyword.matchType)] = true;
  });

  rows("SELECT ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.type, ad_group.resource_name, campaign.name, campaign.status " +
    "FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD' " +
    "AND campaign.status != 'REMOVED'").forEach(function (r) {
    if (!isNova(r.campaign.name) || r.adGroupAd.status === 'REMOVED') return;
    S.ads[r.adGroup.resourceName] = (S.ads[r.adGroup.resourceName] || 0) + 1;
  });

  rows("SELECT campaign_criterion.resource_name, campaign_criterion.type, campaign_criterion.negative, " +
    "campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant, campaign.resource_name, " +
    "campaign.name, campaign.status FROM campaign_criterion WHERE campaign_criterion.type IN ('LOCATION', 'LANGUAGE') " +
    "AND campaign.status != 'REMOVED'").forEach(function (r) {
    var cc = r.campaignCriterion, rn = r.campaign.resourceName;
    if (!isNova(r.campaign.name) || cc.negative) return;
    if (cc.type === 'LOCATION' && cc.location) {
      if (cc.location.geoTargetConstant === MEXICO) S.geo[rn] = true;
      else S.otherGeo[rn] = (S.otherGeo[rn] || 0) + 1;
    }
    if (cc.type === 'LANGUAGE' && cc.language && cc.language.languageConstant === SPANISH) S.lang[rn] = true;
  });

  rows("SELECT shared_set.resource_name, shared_set.name, shared_set.status, shared_set.type FROM shared_set " +
    "WHERE shared_set.name = '" + NEG_LIST + "' AND shared_set.status = 'ENABLED'").forEach(function (r) {
    if (r.sharedSet.name !== NEG_LIST || r.sharedSet.status !== 'ENABLED' || S.set) return;
    S.set = r.sharedSet.resourceName;
    ctx.safe.novaSharedSet[S.set] = true;
  });
  if (S.set) {
    rows("SELECT shared_criterion.resource_name, shared_criterion.keyword.text, shared_criterion.keyword.match_type, " +
      "shared_set.resource_name, shared_set.name FROM shared_criterion WHERE shared_set.name = '" + NEG_LIST + "'").forEach(function (r) {
      if (r.sharedSet.resourceName !== S.set || !r.sharedCriterion.keyword) return;
      S.setCrit[kwKey(r.sharedCriterion.keyword.text, r.sharedCriterion.keyword.matchType)] = true;
    });
    rows("SELECT campaign_shared_set.resource_name, campaign_shared_set.status, campaign.resource_name, campaign.name, " +
      "campaign.status, shared_set.resource_name, shared_set.name FROM campaign_shared_set WHERE shared_set.name = '" + NEG_LIST +
      "' AND campaign.status != 'REMOVED'").forEach(function (r) {
      if (r.sharedSet.resourceName !== S.set || r.campaignSharedSet.status === 'REMOVED') return;
      S.setLinked[r.campaign.resourceName] = true;
    });
  }

  rows("SELECT asset.resource_name, asset.name, asset.type FROM asset WHERE asset.type IN ('SITELINK', 'CALLOUT')").forEach(function (r) {
    if (!isNova(r.asset.name) || S.assets[r.asset.name]) return;
    S.assets[r.asset.name] = r.asset.resourceName;
    ctx.safe.novaAsset[r.asset.resourceName] = true;
  });
  rows("SELECT campaign_asset.resource_name, campaign_asset.field_type, campaign_asset.status, campaign.resource_name, campaign.name, " +
    "campaign.status, asset.resource_name, asset.name FROM campaign_asset WHERE campaign_asset.field_type IN ('SITELINK', 'CALLOUT') " +
    "AND campaign_asset.status != 'REMOVED' AND campaign.status != 'REMOVED'").forEach(function (r) {
    if (!isNova(r.campaign.name) || r.campaignAsset.status === 'REMOVED') return;
    S.assetLinks[r.campaign.resourceName + '|' + r.asset.resourceName] = true;
  });

  rows("SELECT conversion_action.resource_name, conversion_action.name, conversion_action.status, conversion_action.type " +
    "FROM conversion_action WHERE conversion_action.status != 'REMOVED'").forEach(function (r) {
    var a = r.conversionAction;
    if (a.status === 'REMOVED') return;
    if (a.name === CONVERSION_NAME || a.name === CONVERSION_OLD_NAME) S.conv[a.name] = a.resourceName;
  });
  return S;
}

function printPlan(ctx, S, phase) {
  log('PLAN · FASE ' + PHASE + ': MXN ' + phase.total + '/día · Maximizar clics con tope de CPC MXN ' + CPC_CAP_MXN +
    ' · solo México (Presencia) · español · solo Red de Búsqueda de Google');
  CAMPAIGNS.forEach(function (c) {
    var kws = c.adGroups.reduce(function (n, ag) { return n + ag.keywords.length * MATCH_TYPES.length; }, 0);
    log('  ' + c.name + ': ' + (c.enabled ? 'MXN ' + phase.budgets[c.key] + '/día' : 'PAUSADA') + ' · ' + c.adGroups.length +
      ' grupo(s) · ' + kws + ' keywords · ' + c.adGroups.length + ' RSA' + (S.nova[norm(c.name)] ? ' (existe)' : ' (nueva)'));
  });
  var faroOn = S.faro.filter(function (f) { return f.status === 'ENABLED'; });
  log('  Faro: ' + S.faro.length + ' campañas "Faro | …", ' + faroOn.length + ' activas -> todas PAUSADAS' +
    (faroOn.length ? ' (' + faroOn.map(function (f) { return f.name; }).join(' · ') + ')' : ''));
  log('  Negativas "' + NEG_LIST + '": ' + NEGATIVES.length + ' (frase) · sitelinks: ' + SITELINKS.length + ' · callouts: ' + CALLOUTS.length);
  log('  Conversión: ' + (S.conv[CONVERSION_NAME] ? '"' + CONVERSION_NAME + '" ya existe' : S.conv[CONVERSION_OLD_NAME] ?
    (RENAME_CONVERSION ? '"' + CONVERSION_OLD_NAME + '" -> "' + CONVERSION_NAME + '"' : 'se usa "' + CONVERSION_OLD_NAME + '"') : 'NO ENCONTRADA') +
    ' · objetivo personalizado "' + CUSTOM_GOAL + '"');
  log('');
}

// =====================================================================================
// Seguridad: cada operación se revisa antes de mandarse
// =====================================================================================
function assertSafe(ctx, o) {
  var t = Object.keys(o)[0], b = o[t], s = ctx.safe, c = b.create, u = b.update;
  function nova(map, rn, coll) { return !!(map[rn] || (isTemp(rn) && s.temp[rn] === coll)); }
  var ok = false;
  if (b.remove) {
    ok = t === 'campaignLabelOperation' && !!s.faroFrenoLink[b.remove];
  } else if (u) {
    if (t === 'campaignOperation' && s.faroCampaign[u.resourceName]) ok = b.updateMask === 'status' && u.status === 'PAUSED';
    else if (t === 'campaignOperation') ok = !!s.novaCampaign[u.resourceName] && !u.name;
    else if (t === 'campaignBudgetOperation') ok = !!s.novaBudget[u.resourceName] && b.updateMask === 'amount_micros';
    else if (t === 'conversionActionOperation') ok = u.resourceName === s.conversionRename && b.updateMask === 'name' && u.name === CONVERSION_NAME;
    else if (t === 'conversionGoalCampaignConfigOperation') {
      var id = u.resourceName.split('/').pop();
      ok = Object.keys(s.novaCampaign).some(function (rn) { return rn.split('/').pop() === id; });
    }
  } else if (c) {
    if (t === 'campaignBudgetOperation') ok = c.explicitlyShared === false && !c.name && isTemp(c.resourceName);
    else if (t === 'campaignOperation') ok = isNova(c.name) && c.status === 'PAUSED' && c.advertisingChannelType === 'SEARCH' &&
      nova(s.novaBudget, c.campaignBudget, 'campaignBudgets') && c.networkSettings && c.networkSettings.targetContentNetwork === false &&
      c.networkSettings.targetSearchNetwork === false;
    else if (t === 'campaignCriterionOperation') ok = !!s.novaCampaign[c.campaign] && !c.negative &&
      ((c.location && c.location.geoTargetConstant === MEXICO) || (c.language && c.language.languageConstant === SPANISH));
    else if (t === 'adGroupOperation') ok = nova(s.novaCampaign, c.campaign, 'campaigns');
    else if (t === 'adGroupCriterionOperation') ok = nova(s.novaAdGroup, c.adGroup, 'adGroups') && !c.negative;
    else if (t === 'adGroupAdOperation') ok = nova(s.novaAdGroup, c.adGroup, 'adGroups') &&
      c.ad.finalUrls.every(function (x) { return x.indexOf(SITE + '/') === 0; });
    else if (t === 'sharedSetOperation') ok = c.name === NEG_LIST && c.type === 'NEGATIVE_KEYWORDS';
    else if (t === 'sharedCriterionOperation') ok = nova(s.novaSharedSet, c.sharedSet, 'sharedSets');
    else if (t === 'campaignSharedSetOperation') ok = !!s.novaCampaign[c.campaign] && !!s.novaSharedSet[c.sharedSet];
    else if (t === 'assetOperation') ok = isNova(c.name);
    else if (t === 'campaignAssetOperation') ok = !!s.novaCampaign[c.campaign] && !!s.novaAsset[c.asset];
    else if (t === 'customConversionGoalOperation') ok = c.name === CUSTOM_GOAL;
  }
  if (!ok) throw new Error('SEGURIDAD: operación bloqueada (fuera de Nova / Faro-pausa): ' + JSON.stringify(o).slice(0, 400));
}

/**
 * Manda operaciones. atomic = un solo lote todo-o-nada (necesario con IDs temporales).
 * Devuelve [{ok, rn}] paralelo a items. En Vista previa los IDs de entidades NUEVAS no sirven (rn = null).
 */
function send(ctx, label, items, atomic) {
  if (!items.length) return [];
  items.forEach(function (x) { assertSafe(ctx, x.op); });
  if (DRY_RUN) {
    log('  [dry run] ' + label + ': ' + items.length + ' operaciones');
    items.forEach(function (x) { log('    (dry run) ' + x.desc); });
    ctx.sent += items.length;
    return items.map(function () { return { ok: false, rn: null }; });
  }
  if (atomic && items.length > MAX_OPS) throw new Error('Lote "' + label + '" con ' + items.length + ' operaciones (máx. ' + MAX_OPS + ')');
  var out = [];
  for (var i = 0; i < items.length; i += MAX_OPS) {
    var part = items.slice(i, i + MAX_OPS);
    var res;
    try {
      res = AdsApp.mutateAll(part.map(function (x) { return x.op; }), { partialFailure: !atomic });
    } catch (e) {
      log('  ✗ ' + label + ': mutateAll falló: ' + (e.message || e));
      ctx.failed += part.length;
      part.forEach(function () { out.push({ ok: false, rn: null }); });
      continue;
    }
    var anyBad = res.some(function (r) { return !r.isSuccessful(); });
    var good = 0;
    res.forEach(function (r, j) {
      var okOne = r.isSuccessful() && !(atomic && anyBad);
      var body = part[j].op[Object.keys(part[j].op)[0]];
      var rn = null;
      if (okOne && !(ctx.preview && body.create)) { try { rn = r.getResourceName(); } catch (e) { rn = null; } }
      if (okOne) good++;
      else if (!r.isSuccessful()) log('    FAIL ' + part[j].desc + ' :: ' + (r.getErrorMessages() || []).join(' | '));
      out.push({ ok: okOne, rn: rn });
    });
    ctx.sent += good;
    ctx.failed += part.length - good;
    if (anyBad && atomic) log('  ✗ ' + label + ': lote revertido (' + part.length + ' operaciones, todo-o-nada)');
    else log('  ' + (anyBad ? '~ ' : '✓ ') + label + ': ' + good + '/' + part.length + ' operaciones' + (ctx.preview ? ' (simuladas)' : ''));
    if (part.length <= 12) part.forEach(function (x, j) { if (out[i + j].ok) log('      ' + x.desc); });
  }
  return out;
}

// =====================================================================================
// 1. Faro: todo pausado y sin etiqueta del freno
// =====================================================================================
function pauseFaro(ctx, S) {
  log('[1] Campañas "Faro | …" -> PAUSADAS');
  var items = [];
  S.labels.forEach(function (l) {
    if (l.label !== FARO_FRENO || !ctx.safe.faroCampaign[l.campaign]) return;
    ctx.safe.faroFrenoLink[l.rn] = true;
    items.push({ op: { campaignLabelOperation: { remove: l.rn } }, desc: l.campaignName + ': − etiqueta ' + FARO_FRENO + ' (el freno de Faro ya no la reactiva)' });
  });
  S.faro.forEach(function (f) {
    if (f.status !== 'ENABLED') return;
    items.push({ op: { campaignOperation: { update: { resourceName: f.rn, status: 'PAUSED' }, updateMask: 'status' } }, desc: f.name + ': ENABLED -> PAUSED' });
  });
  if (!items.length) { log('  = ' + S.faro.length + ' campañas Faro, todas pausadas'); return; }
  send(ctx, 'Faro pausado', items, false);
}

// =====================================================================================
// 2. Conversión "Compra"
// =====================================================================================
function ensureConversion(ctx, S) {
  log('[2] Conversión "' + CONVERSION_NAME + '"');
  if (S.conv[CONVERSION_NAME]) { log('  = existe "' + CONVERSION_NAME + '"'); return S.conv[CONVERSION_NAME]; }
  var old = S.conv[CONVERSION_OLD_NAME];
  if (!old) {
    var w = 'No existe "' + CONVERSION_NAME + '" ni "' + CONVERSION_OLD_NAME + '". Las campañas corren igual (Maximizar clics), pero ' +
      'sin medir compras: crea la conversión en Objetivos > Conversiones (Compra, sitio web) y vuelve a correr el script.';
    ctx.warnings.push(w); log('  ! ' + w);
    return null;
  }
  if (!RENAME_CONVERSION) { log('  = se usa "' + CONVERSION_OLD_NAME + '" (RENAME_CONVERSION = false)'); return old; }
  ctx.safe.conversionRename = old;
  var r = send(ctx, 'renombrar conversión', [{ op: { conversionActionOperation: { update: { resourceName: old, name: CONVERSION_NAME }, updateMask: 'name' } },
    desc: '"' + CONVERSION_OLD_NAME + '" -> "' + CONVERSION_NAME + '" (misma etiqueta send_to; cuenta para Faro y Nova)' }], false);
  if (!DRY_RUN && !(r[0] && r[0].ok)) {
    var w2 = 'No se pudo renombrar "' + CONVERSION_OLD_NAME + '"; se usa con su nombre actual. Renómbrala a mano si quieres.';
    ctx.warnings.push(w2); log('  ! ' + w2);
  }
  return old; // el resource name no cambia al renombrar
}

// =====================================================================================
// 3. Negativas
// =====================================================================================
function ensureNegatives(ctx, S) {
  log('[3] Lista compartida "' + NEG_LIST + '"');
  var items = [], setRn = S.set;
  if (!setRn) {
    setRn = tempRn(ctx, 'sharedSets');
    items.push({ op: { sharedSetOperation: { create: { resourceName: setRn, name: NEG_LIST, type: 'NEGATIVE_KEYWORDS' } } }, desc: '+ lista ' + NEG_LIST });
  }
  NEGATIVES.forEach(function (n) {
    if (S.setCrit[kwKey(n, 'PHRASE')]) return;
    items.push({ op: { sharedCriterionOperation: { create: { sharedSet: setRn, keyword: { text: n, matchType: 'PHRASE' } } } }, desc: '+ negativa "' + n + '" [frase]' });
  });
  if (!items.length) { log('  = al día (' + NEGATIVES.length + ' negativas)'); return setRn; }
  var r = send(ctx, NEG_LIST + ' (' + items.length + ' operaciones)', items, isTemp(setRn));
  if (isTemp(setRn)) {
    setRn = r[0] && r[0].ok ? r[0].rn : null;
    if (setRn) ctx.safe.novaSharedSet[setRn] = true;
  }
  return setRn;
}

// =====================================================================================
// 4. Assets
// =====================================================================================
function ensureAssets(ctx, S) {
  log('[4] Sitelinks y callouts "Nova | …"');
  var want = [];
  SITELINKS.forEach(function (s) {
    want.push({ name: 'Nova | Sitelink | ' + s.linkText, type: 'SITELINK',
      create: { finalUrls: [s.url], sitelinkAsset: { linkText: s.linkText, description1: s.description1, description2: s.description2 } } });
  });
  CALLOUTS.forEach(function (t) { want.push({ name: 'Nova | Callout | ' + t, type: 'CALLOUT', create: { calloutAsset: { calloutText: t } } }); });
  var byName = {}, items = [], pending = [];
  want.forEach(function (a) {
    if (S.assets[a.name]) { byName[a.name] = { rn: S.assets[a.name], type: a.type }; return; }
    var create = { name: a.name };
    Object.keys(a.create).forEach(function (k) { create[k] = a.create[k]; });
    items.push({ op: { assetOperation: { create: create } }, desc: '+ asset ' + a.name });
    pending.push(a);
  });
  if (!items.length) log('  = al día (' + want.length + ' assets)');
  var r = send(ctx, 'assets', items, false);
  pending.forEach(function (a, i) {
    var rn = r[i] && r[i].ok ? r[i].rn : null;
    byName[a.name] = { rn: rn, type: a.type };
    if (rn) ctx.safe.novaAsset[rn] = true;
  });
  return byName;
}

// =====================================================================================
// 5. Campañas
// =====================================================================================
function ensureCampaign(ctx, S, c, phase) {
  var cur = S.nova[norm(c.name)];
  log('[5] ' + c.name + (cur ? ' (existe, ' + cur.status + ')' : ' (nueva)'));
  var budget = micros(phase.budgets[c.key] || 0), cap = micros(CPC_CAP_MXN);
  var campRn, chain = [];

  if (!cur) {
    var budgetRn = tempRn(ctx, 'campaignBudgets');
    campRn = tempRn(ctx, 'campaigns');
    chain.push({ op: { campaignBudgetOperation: { create: { resourceName: budgetRn, amountMicros: budget, deliveryMethod: 'STANDARD', explicitlyShared: false } } },
      desc: '+ presupuesto ' + mxn(budget) + '/día' });
    chain.push({ op: { campaignOperation: { create: {
      resourceName: campRn, name: c.name, status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: budgetRn,
      targetSpend: { cpcBidCeilingMicros: cap },
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false },
      geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' },
      finalUrlSuffix: suffixFor(c),
      containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    } } }, desc: '+ campaña ' + c.name + ' (PAUSADA hasta tener México + español), Maximizar clics tope ' + mxn(cap) });
  } else {
    campRn = cur.rn;
    if (cur.type && cur.type !== 'SEARCH') { log('  AVISO: no es de Búsqueda; no la toco.'); ctx.warnings.push(c.name + ' no es de Búsqueda'); return null; }
    var upd = { resourceName: cur.rn }, mask = [], notes = [];
    if (cur.portfolio) ctx.warnings.push(c.name + ': usa una estrategia de cartera; no se toca la puja.');
    else if (SWITCHABLE.indexOf(cur.bst) < 0) ctx.warnings.push(c.name + ': usa ' + cur.bst + '; no se toca la puja.');
    else if (cur.bst !== 'TARGET_SPEND' || String(cur.ceiling) !== cap) {
      upd.targetSpend = { cpcBidCeilingMicros: cap }; mask.push('target_spend.cpc_bid_ceiling_micros');
      notes.push(cur.bst + ' ' + mxn(cur.ceiling) + ' -> Maximizar clics tope ' + mxn(cap));
    }
    if (cur.geoType !== 'PRESENCE') { upd.geoTargetTypeSetting = { positiveGeoTargetType: 'PRESENCE' }; mask.push('geo_target_type_setting.positive_geo_target_type'); notes.push('ubicación -> Presencia'); }
    var net = cur.net || {};
    if (net.targetGoogleSearch !== true || net.targetSearchNetwork !== false || net.targetContentNetwork !== false) {
      upd.networkSettings = { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false };
      mask.push('network_settings.target_google_search', 'network_settings.target_search_network', 'network_settings.target_content_network');
      notes.push('redes -> solo Búsqueda de Google');
    }
    if (cur.suffix !== suffixFor(c)) { upd.finalUrlSuffix = suffixFor(c); mask.push('final_url_suffix'); notes.push('sufijo de URL'); }
    var items = [];
    if (mask.length) items.push({ op: { campaignOperation: { update: upd, updateMask: mask.join(',') } }, desc: c.name + ': ' + notes.join('; ') });
    if (cur.sharedBudget) ctx.warnings.push(c.name + ': presupuesto compartido; ajústalo a mano a ' + mxn(budget) + '/día.');
    else if (cur.budgetRn && String(cur.budget) !== budget) {
      items.push({ op: { campaignBudgetOperation: { update: { resourceName: cur.budgetRn, amountMicros: budget }, updateMask: 'amount_micros' } },
        desc: c.name + ': presupuesto ' + mxn(cur.budget) + ' -> ' + mxn(budget) + '/día (fase ' + PHASE + ')' });
    }
    send(ctx, c.name + ': ajustes', items, false);
  }

  // Grupos, keywords y anuncios (en el mismo lote que la campaña nueva; con el rn real si ya existía)
  c.adGroups.forEach(function (ag) {
    var agRn = cur ? S.adGroups[norm(c.name) + '||' + norm(ag.name)] : null;
    if (!agRn) {
      agRn = tempRn(ctx, 'adGroups');
      chain.push({ op: { adGroupOperation: { create: { resourceName: agRn, campaign: campRn, name: ag.name, status: 'ENABLED', type: 'SEARCH_STANDARD' } } },
        desc: '+ grupo ' + ag.name });
    }
    ag.keywords.forEach(function (k) {
      MATCH_TYPES.forEach(function (m) {
        if (!isTemp(agRn) && S.keywords[agRn] && S.keywords[agRn][kwKey(k, m)]) return;
        chain.push({ op: { adGroupCriterionOperation: { create: { adGroup: agRn, status: 'ENABLED', keyword: { text: k, matchType: m } } } },
          desc: ag.name + ': + "' + k + '" [' + m + ']' });
      });
    });
    if (isTemp(agRn) || !S.ads[agRn]) {
      var rsa = {
        headlines: headlinesFor(ag).map(function (h) { return { text: h }; }),
        descriptions: DESCRIPTIONS.map(function (d) { return d.pin ? { text: d.text, pinnedField: d.pin } : { text: d.text }; }),
      };
      if (ag.path1) rsa.path1 = ag.path1;
      if (ag.path1 && ag.path2) rsa.path2 = ag.path2;
      chain.push({ op: { adGroupAdOperation: { create: { adGroup: agRn, status: 'ENABLED', ad: { finalUrls: [ag.url], responsiveSearchAd: rsa } } } },
        desc: ag.name + ': + RSA -> ' + ag.url, ad: true });
    }
  });
  if (!chain.length) { if (cur) log('  = grupos, keywords y anuncios al día'); return campRn; }

  var r = send(ctx, c.name + ': ' + (cur ? 'grupos/keywords/anuncios' : 'campaña + grupos + keywords + anuncios'), chain, true);
  var okAll = r.length && r.every(function (x) { return x.ok; });
  if (!okAll && !DRY_RUN && chain.some(function (x) { return x.ad; })) {
    // Un anuncio rechazado tumba el lote: se reintenta sin anuncios y luego cada anuncio por separado.
    log('  ↻ reintento sin anuncios y luego cada anuncio por separado');
    ctx.failed -= chain.length;
    var noAds = chain.filter(function (x) { return !x.ad; });
    var r2 = send(ctx, c.name + ' (sin anuncios)', noAds, true);
    var map = {};
    noAds.forEach(function (x, i) {
      var body = x.op[Object.keys(x.op)[0]];
      if (body.create && isTemp(body.create.resourceName) && r2[i] && r2[i].ok) map[body.create.resourceName] = r2[i].rn;
    });
    if (r2.length && r2.every(function (x) { return x.ok; })) {
      registerReal(ctx, map);
      if (!cur) campRn = map[campRn] || null;
      chain.filter(function (x) { return x.ad; }).forEach(function (x) {
        var ad = JSON.parse(JSON.stringify(x));
        var g = ad.op.adGroupAdOperation.create.adGroup;
        if (isTemp(g)) g = map[g];
        if (!g) { ctx.deferred++; log('    - anuncio diferido (grupo sin ID' + (ctx.preview ? ' en Vista previa' : '') + '): ' + x.desc); return; }
        ad.op.adGroupAdOperation.create.adGroup = g;
        send(ctx, 'anuncio ' + x.desc, [ad], true);
      });
      if (!cur) return campRn;
    } else if (!cur) {
      ctx.manual.push(c.name + ' no se pudo crear (ver FAIL arriba). Manda el registro al director.');
      return null;
    }
    return campRn;
  }
  if (!okAll) {
    if (!cur && !DRY_RUN) ctx.manual.push(c.name + ' no se pudo crear (ver FAIL arriba). Manda el registro al director.');
    return cur ? campRn : null;
  }
  if (!cur) {
    var m2 = {};
    chain.forEach(function (x, i) {
      var body = x.op[Object.keys(x.op)[0]];
      if (body.create && isTemp(body.create.resourceName) && r[i].rn) m2[body.create.resourceName] = r[i].rn;
    });
    registerReal(ctx, m2);
    return m2[campRn] || null; // null en Vista previa: lo que depende de la campaña queda diferido
  }
  return campRn;
}

function registerReal(ctx, map) {
  Object.keys(map).forEach(function (t) {
    if (!map[t]) return;
    if (t.indexOf('/campaigns/') !== -1) ctx.safe.novaCampaign[map[t]] = true;
    else if (t.indexOf('/adGroups/') !== -1) ctx.safe.novaAdGroup[map[t]] = true;
    else if (t.indexOf('/campaignBudgets/') !== -1) ctx.safe.novaBudget[map[t]] = true;
  });
}

// =====================================================================================
// 6. México + español (con el resource name REAL de la campaña)
// =====================================================================================
function ensureTargeting(ctx, S, real) {
  log('[6] Ubicación (México, Presencia) e idioma (español)');
  var d0 = ctx.deferred;
  var items = [], who = [], targeted = {};
  CAMPAIGNS.forEach(function (c) {
    var rn = real[c.key];
    if (!rn) {
      if (!S.nova[norm(c.name)]) { ctx.deferred += 2; log('  - ' + c.name + ': diferido (' + (ctx.preview ? 'Vista previa: la campaña nueva no tiene ID' : DRY_RUN ? 'dry run' : 'la campaña no se creó') + ')'); }
      return;
    }
    targeted[c.key] = { mx: !!S.geo[rn], es: !!S.lang[rn] };
    if (S.otherGeo[rn]) ctx.warnings.push(c.name + ' tiene ' + S.otherGeo[rn] + ' ubicación(es) además de México: quítalas a mano (debe ser solo México).');
    if (!S.geo[rn]) { items.push({ op: { campaignCriterionOperation: { create: { campaign: rn, location: { geoTargetConstant: MEXICO } } } }, desc: c.name + ': + México' }); who.push([c.key, 'mx']); }
    if (!S.lang[rn]) { items.push({ op: { campaignCriterionOperation: { create: { campaign: rn, language: { languageConstant: SPANISH } } } }, desc: c.name + ': + español' }); who.push([c.key, 'es']); }
  });
  if (!items.length) { if (ctx.deferred === d0) log('  = al día'); return targeted; }
  var r = send(ctx, 'ubicación + idioma', items, false);
  who.forEach(function (w, i) { if (r[i] && r[i].ok) targeted[w[0]][w[1]] = true; });
  return targeted;
}

// =====================================================================================
// 7. Lista negativa + assets vinculados a cada campaña Nova
// =====================================================================================
function ensureLinks(ctx, S, real, setRn, assets) {
  log('[7] Lista negativa y assets en cada campaña');
  var d0 = ctx.deferred;
  var items = [];
  CAMPAIGNS.forEach(function (c) {
    var rn = real[c.key];
    if (!rn) { if (!S.nova[norm(c.name)]) ctx.deferred += 1 + Object.keys(assets).length; return; }
    if (!S.setLinked[rn]) {
      if (setRn && !isTemp(setRn)) items.push({ op: { campaignSharedSetOperation: { create: { campaign: rn, sharedSet: setRn } } }, desc: c.name + ': + lista ' + NEG_LIST });
      else ctx.deferred++;
    }
    Object.keys(assets).forEach(function (name) {
      var a = assets[name];
      if (a.rn && S.assetLinks[rn + '|' + a.rn]) return;
      if (!a.rn) { ctx.deferred++; return; }
      items.push({ op: { campaignAssetOperation: { create: { campaign: rn, asset: a.rn, fieldType: a.type } } }, desc: c.name + ': + ' + name });
    });
  });
  if (!items.length) { log(ctx.deferred === d0 ? '  = al día' : '  - diferido: las campañas nuevas no tienen ID en Vista previa'); return; }
  send(ctx, 'vínculos (lista + assets)', items, false);
}

// =====================================================================================
// 8. Estado de las campañas Nova (activar solo con México + español; respetar el freno)
// =====================================================================================
function ensureStatus(ctx, S, real, targeted) {
  log('[8] Estado de las campañas Nova');
  var d0 = ctx.deferred;
  var braked = {};
  S.labels.forEach(function (l) { if (l.label === NOVA_FRENO) braked[l.campaign] = true; });
  var items = [];
  CAMPAIGNS.forEach(function (c) {
    var rn = real[c.key], cur = S.nova[norm(c.name)];
    if (!rn) { if (!cur && c.enabled) { ctx.deferred++; log('  - ' + c.name + ': activación diferida'); } return; }
    var status = cur ? cur.status : 'PAUSED';
    var t = targeted[c.key] || {};
    if (c.enabled && status !== 'ENABLED') {
      if (braked[rn]) { log('  = ' + c.name + ': pausada por el freno (' + NOVA_FRENO + '); la reactiva el freno al día siguiente.'); return; }
      if (!t.mx || !t.es) {
        var w = c.name + ': NO se activa porque le falta ' + (!t.mx ? 'México' : 'español') + '. Vuelve a correr el script.';
        if (DRY_RUN) { log('  - ' + w + ' (dry run)'); return; }
        ctx.warnings.push(w); log('  ! ' + w); return;
      }
      items.push({ op: { campaignOperation: { update: { resourceName: rn, status: 'ENABLED' }, updateMask: 'status' } }, desc: c.name + ': ' + status + ' -> ENABLED' });
    } else if (!c.enabled && status === 'ENABLED') {
      items.push({ op: { campaignOperation: { update: { resourceName: rn, status: 'PAUSED' }, updateMask: 'status' } }, desc: c.name + ': ENABLED -> PAUSED (plan)' });
    }
  });
  if (!items.length) { if (ctx.deferred === d0) log('  = al día'); return; }
  send(ctx, 'estado', items, false);
}

// =====================================================================================
// 9. Objetivo personalizado "Nova | Compra" en cada campaña Nova
// =====================================================================================
function ensureGoal(ctx, S, real, action) {
  log('[9] Objetivo de conversión "' + CUSTOM_GOAL + '"');
  if (!action) { log('  - sin conversión; se omite'); return; }
  var goals = rows("SELECT custom_conversion_goal.resource_name, custom_conversion_goal.name, custom_conversion_goal.status, " +
    "custom_conversion_goal.conversion_actions FROM custom_conversion_goal", true);
  if (goals === null) {
    ctx.manual.push('Objetivos > Objetivos de conversión personalizados > "' + CUSTOM_GOAL + '" con solo "' + CONVERSION_NAME +
      '"; luego en cada campaña Nova: Configuración > Objetivos > usar ese objetivo.');
    return;
  }
  var goal = null;
  goals.forEach(function (g) {
    var x = g.customConversionGoal;
    if (x.name === CUSTOM_GOAL && x.status !== 'REMOVED' && !goal) goal = x;
  });
  var goalRn = goal ? goal.resourceName : null;
  if (goal && (goal.conversionActions || []).indexOf(action) === -1) ctx.warnings.push('"' + CUSTOM_GOAL + '" existe pero no contiene la conversión de compra; corrígelo en la interfaz.');
  if (!goal) {
    var r = send(ctx, 'objetivo personalizado', [{ op: { customConversionGoalOperation: { create: { name: CUSTOM_GOAL, conversionActions: [action], status: 'ENABLED' } } },
      desc: '+ ' + CUSTOM_GOAL + ' (' + CONVERSION_NAME + ')' }], true);
    goalRn = r[0] && r[0].ok ? r[0].rn : null;
    if (!goalRn) {
      var n = CAMPAIGNS.length;
      ctx.deferred += n;
      log('  - asignación a campañas diferida' + (ctx.preview ? ' (Vista previa)' : ''));
      if (!ctx.preview && !DRY_RUN) ctx.manual.push('Crea el objetivo "' + CUSTOM_GOAL + '" a mano (solo "' + CONVERSION_NAME + '") y asígnalo a las campañas Nova.');
      return;
    }
  }
  var cfg = {};
  (rows("SELECT conversion_goal_campaign_config.resource_name, conversion_goal_campaign_config.campaign, " +
    "conversion_goal_campaign_config.goal_config_level, conversion_goal_campaign_config.custom_conversion_goal " +
    "FROM conversion_goal_campaign_config", true) || []).forEach(function (r) { cfg[r.conversionGoalCampaignConfig.campaign] = r.conversionGoalCampaignConfig; });
  var items = [];
  CAMPAIGNS.forEach(function (c) {
    var rn = real[c.key];
    if (!rn) { if (!S.nova[norm(c.name)]) ctx.deferred++; return; }
    var g = cfg[rn];
    if (g && g.goalConfigLevel === 'CAMPAIGN' && g.customConversionGoal === goalRn) return;
    items.push({ op: { conversionGoalCampaignConfigOperation: { update: {
      resourceName: 'customers/' + ctx.cid + '/conversionGoalCampaignConfigs/' + rn.split('/').pop(), goalConfigLevel: 'CAMPAIGN', customConversionGoal: goalRn,
    }, updateMask: 'goal_config_level,custom_conversion_goal' } }, desc: c.name + ': objetivo -> ' + CUSTOM_GOAL });
  });
  if (!items.length) { log('  = al día'); return; }
  var res = send(ctx, 'objetivo por campaña', items, false);
  if (!DRY_RUN && res.some(function (x) { return !x.ok; })) ctx.manual.push('En cada campaña Nova: Configuración > Objetivos > "Usar un objetivo de conversión personalizado" > "' + CUSTOM_GOAL + '".');
}

// =====================================================================================
// 10. send_to para novaphone.lat
// =====================================================================================
function reportSendTo(ctx, action) {
  log('[10] Etiqueta de conversión para novaphone.lat');
  if (!action) { log('  - sin conversión'); return; }
  var rs = rows("SELECT conversion_action.resource_name, conversion_action.tag_snippets FROM conversion_action " +
    "WHERE conversion_action.resource_name = '" + action + "'", true) || [];
  var snippets = rs.length ? (rs[0].conversionAction.tagSnippets || []) : [];
  var sendTo = null;
  snippets.forEach(function (t) {
    var m = String(t.eventSnippet || '').match(/send_to['"]?\s*:\s*['"](AW-[0-9]+\/[A-Za-z0-9_\-]+)['"]/);
    if (m && !sendTo) sendTo = m[1];
  });
  if (!sendTo) { log('  - no disponible; búscalo en Objetivos > Conversiones > "' + CONVERSION_NAME + '" > Configuración de la etiqueta.'); return; }
  var p = sendTo.split('/');
  log('  >>> NEXT_PUBLIC_GOOGLE_ADS_ID=' + p[0]);
  log('  >>> NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=' + p[1] + '   (Vercel > novaphone > Environment Variables, Production)');
}

// =====================================================================================
function summary(ctx) {
  log('');
  log('='.repeat(78));
  if (ctx.warnings.length) { log('AVISOS (' + ctx.warnings.length + '):'); ctx.warnings.forEach(function (w) { log('  ! ' + w); }); }
  if (ctx.manual.length) { log('PASOS A MANO (' + ctx.manual.length + '):'); ctx.manual.forEach(function (m) { log('  > ' + m); }); }
  log('Operaciones: ' + ctx.sent + ' ' + (DRY_RUN ? 'planeadas' : ctx.preview ? 'simuladas' : 'aplicadas') + ' · ' + ctx.failed + ' fallidas · ' +
    ctx.deferred + ' diferidas (dependen de IDs nuevos que la Vista previa no guarda)');
  if (!ctx.sent && !ctx.failed && !ctx.deferred) log('Nada que cambiar: la cuenta ya coincide con el plan.');
  else if (ctx.preview) log('VISTA PREVIA: Google solo simuló los cambios; no se aplicó nada. Si no hay FAIL ni ABORTADO, dale Ejecutar.');
  else if (DRY_RUN) log('DRY_RUN: no se aplicó nada.');
  else if (ctx.failed) log('TERMINÓ CON ERRORES: copia todo el registro y mándalo al director. Volver a correrlo es seguro.');
  else log('Listo. Vuelve a correr la Vista previa: debe decir "Nada que cambiar".');
  log('='.repeat(78));
}

#!/usr/bin/env node
// Runs docs/ads/novaphone-ads.js (+ novaphone-freno.js and the read-only google-ads-report.js) inside a Node vm against a
// mocked LIVE Google Ads account 823-438-8697 as it stands on 15-oct-2026: Faro campaigns (5 enabled, 3 paused, one of them
// braked with the "Faro|freno" label), "Faro | Negatives", Faro sitelinks, the conversion action "Compra Faro" with its
// custom goal, plus a NON-Faro / NON-Nova campaign ("Nahui Leads") that must never be touched.
//
//   node docs/ads/validate-novaphone-ads.mjs        (exit 1 on any error)
//
// Scenarios: fresh run (creates everything, Faro paused), idempotent re-run ("Nada que cambiar"), Preview, DRY_RUN,
// phase ramp 1 -> 2 -> 3 (budgets only), forbidden ad copy aborts, targeting failure keeps the campaign paused,
// a rejected ad is retried alone, Nova brake respected, conversion variants, brake script, report script.
// Checks: no JS errors, GAQL WHERE fields are SELECTed, char limits, URLs, temp IDs, only Nova/Faro-pause ops.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(join(HERE, "novaphone-ads.js"), "utf8");
const REPORT = readFileSync(join(HERE, "google-ads-report.js"), "utf8");
const FRENO = readFileSync(join(HERE, "novaphone-freno.js"), "utf8");
const errors = [];
const err = (m) => errors.push(m);
const ok = (m) => console.log(`  ok  ${m}`);
let done = false;
// Report on exit, so a crash in a later scenario still prints the errors collected so far.
process.on("exit", (code) => {
  for (const e of errors) console.error(`ERROR ${e}`);
  if (!done) console.error("validate-novaphone-ads: aborted by an exception (see above)");
  if (errors.length || !done) { console.error(`${errors.length} error(s).`); process.exitCode = 1; return; }
  if (code === 0) console.log("validate-novaphone-ads: all checks passed");
});
const C = "8234388697";
const SITE = "https://novaphone.lat";
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const clen = (s) => [...String(s)].length;
const isNova = (n) => /^nova \| /i.test(n || "");
const isFaro = (n) => /^faro \| /i.test(n || "");

// ----------------------------------------------------------------------------- Expected plan (independent copy)
const PLAN = {
  "Nova | Search | eSIM México": { key: "esim", slug: "nova-esim-mexico", groups: {
    "eSIM México": ["esim mexico", "esim en mexico", "comprar esim mexico", "esim prepago mexico"],
    "eSIM de datos": ["esim de datos", "esim solo datos", "esim para tablet", "internet para celular prepago"],
    "eSIM sin contrato": ["esim sin registro", "esim sin contrato"] } },
  "Nova | Search | Telcel/Chip virtual": { key: "telcel", slug: "nova-telcel-chip-virtual", groups: {
    "eSIM Telcel": ["esim telcel"], "Chip virtual": ["chip virtual mexico", "chip virtual telcel"] } },
  "Nova | Search | Brand": { key: "brand", slug: "nova-brand", groups: { NovaPhone: ["novaphone", "nova phone", "novaphone esim"] } },
};
const PHASES = { 1: { esim: 90, telcel: 40, brand: 20, total: 150 }, 2: { esim: 170, telcel: 80, brand: 30, total: 280 }, 3: { esim: 200, telcel: 95, brand: 35, total: 330 } };
const NEGS = ["gratis", "free", "hack", "clonar", "personal", "activar", "como registrar", "registrar mi", "registro de telefonia", "ift", "crt", "ley",
  "multa", "imei", "liberar", "desbloquear", "telcel app", "mi telcel", "recarga telcel", "saldo telcel", "amigo sin limite", "iphone precio",
  "plan tarifario", "pospago", "factura"];
const MUST_HEADLINES = ["eSIM de datos para México", "Activa en 2 minutos", "Sin contrato ni plazos", "Red Telcel 5G", "20 GB por $599",
  "Paga con tarjeta o SPEI", "QR al instante por correo", "Garantía de conexión"];
const SITELINK_TEXTS = ["Planes", "Cómo funciona", "Compatibilidad", "Preguntas"];
const BAD_COPY = /registr|curp|\bine\b|an[oó]nim|sin papeleo|document|evita|elud|sin rastro/i;

// ----------------------------------------------------------------------------- Mock account
function newDb(variant = {}) {
  let seq = 100;
  const id = (coll) => `customers/${C}/${coll}/${++seq}`;
  const db = { seq: 10000, campaigns: [], budgets: [], adGroups: [], keywords: [], ads: [], campaignCriteria: [], sharedSets: [], sharedCriteria: [],
    campaignSharedSets: [], assets: [], links: [], labels: [], campaignLabels: [], conversionActions: [], customGoals: [], goalConfigs: {}, costToday: {} };
  const addCampaign = (name, status = "ENABLED", amount = 100) => {
    const b = { rn: id("campaignBudgets"), amount: String(amount * 1e6), shared: false };
    db.budgets.push(b);
    const c = { rn: id("campaigns"), name, status, type: "SEARCH", bst: "TARGET_SPEND", ceiling: "12000000", geoType: "PRESENCE",
      net: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false }, suffix: "utm_source=google", budget: b.rn };
    db.campaigns.push(c);
    db.goalConfigs[c.rn] = { level: "CUSTOMER", goal: null };
    return c;
  };
  const nc = addCampaign("Nahui Leads", "ENABLED", 500);
  nc.bst = "MANUAL_CPC"; nc.ceiling = null;
  const nag = { rn: id("adGroups"), name: "Nahui AG", campaign: nc.rn, status: "ENABLED" };
  db.adGroups.push(nag);
  db.keywords.push({ rn: id("adGroupCriteria"), adGroup: nag.rn, text: "esim mexico", match: "PHRASE", status: "ENABLED" });
  db.campaignCriteria.push({ rn: id("campaignCriteria"), campaign: nc.rn, type: "LOCATION", geo: "geoTargetConstants/2484" });
  db.labels.push({ rn: id("labels"), name: "Faro|freno", description: "2026-10-15" });
  for (const [n, st] of [["Europe Unlimited | ES", "ENABLED"], ["Countries | ES", "ENABLED"], ["Competitors | ES", "ENABLED"], ["Brand | ES", "ENABLED"],
    ["Brand | EN", "PAUSED"], ["Europe Unlimited | EN", "PAUSED"], ["Countries | EN", "PAUSED"], ["Competitors | EN", "PAUSED"]]) {
    const c = addCampaign(`Faro | Search | ${n}`, st, 50);
    const g = { rn: id("adGroups"), name: `Faro | ${n}`, campaign: c.rn, status: "ENABLED" };
    db.adGroups.push(g);
    db.keywords.push({ rn: id("adGroupCriteria"), adGroup: g.rn, text: "esim europa", match: "PHRASE", status: "ENABLED" });
    db.ads.push({ rn: `customers/${C}/adGroupAds/${g.rn.split("/").pop()}~1`, adGroup: g.rn, status: "ENABLED", finalUrls: ["https://faroesim.com/es"] });
    db.campaignCriteria.push({ rn: id("campaignCriteria"), campaign: c.rn, type: "LOCATION", geo: "geoTargetConstants/2484" });
    if (n === "Brand | EN") db.campaignLabels.push({ rn: id("campaignLabels"), campaign: c.rn, label: db.labels[0].rn, status: "ENABLED" }); // braked by Faro freno
  }
  // A Faro campaign braked today that is still ENABLED in the read (race with the hourly brake): must be paused AND unlabeled
  db.campaignLabels.push({ rn: id("campaignLabels"), campaign: db.campaigns.find((c) => c.name === "Faro | Search | Brand | ES").rn, label: db.labels[0].rn, status: "ENABLED" });
  const fset = { rn: id("sharedSets"), name: "Faro | Negatives", status: "ENABLED" };
  db.sharedSets.push(fset);
  for (const t of ["gratis", "prepago"]) db.sharedCriteria.push({ rn: id("sharedCriteria"), sharedSet: fset.rn, text: t, match: "PHRASE" });
  const fa = { rn: id("assets"), name: "Faro | Sitelink | ES | España | 2026-10-15", type: "SITELINK", finalUrls: ["https://faroesim.com/es/esim/spain"], sitelinkAsset: { linkText: "España" } };
  db.assets.push(fa);
  if (variant.conversion !== "none") {
    const name = variant.conversion === "compra" ? "Compra" : "Compra Faro";
    const ca = { rn: id("conversionActions"), name, status: "ENABLED", type: "WEBPAGE" };
    db.conversionActions.push(ca);
    db.customGoals.push({ rn: id("customConversionGoals"), name: "Faro | Compra Faro", status: "ENABLED", actions: [ca.rn] });
  }
  return db;
}

function makeEnv(db, opts = {}) {
  const logs = [], calls = [], queries = [];
  const byRn = (list, rn) => list.find((x) => x.rn === rn);
  const camp = (rn) => byRn(db.campaigns, rn);
  const novaCamp = (rn) => isNova(camp(rn)?.name);
  const groupCamp = (agRn) => byRn(db.adGroups, agRn)?.campaign;
  const live = (x) => x.status !== "REMOVED";

  function checkGaql(q) {
    const m = /^\s*SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)([\s\S]*)$/i.exec(q);
    if (!m) return err(`malformed GAQL: ${q}`);
    const fields = m[1].split(",").map((f) => f.trim());
    const where = /\bWHERE\b([\s\S]*?)(\bORDER BY\b|\bLIMIT\b|$)/i.exec(m[3]);
    if (where) for (const ref of where[1].replace(/'[^']*'/g, "").match(/\b[a-z_]+(?:\.[a-z_0-9]+)+\b/g) || []) if (!fields.includes(ref)) err(`GAQL WHERE field ${ref} not in SELECT: ${q.slice(0, 160)}`);
    for (const f of fields) if (!/^[a-z_]+(\.[a-z_0-9]+)+$/.test(f)) err(`GAQL odd field "${f}"`);
  }
  const campRow = (c) => ({ resourceName: c.rn, name: c.name, status: c.status, advertisingChannelType: c.type });
  function search(q) {
    queries.push(q);
    checkGaql(q);
    const from = (q.match(/FROM\s+(\w+)/) || [])[1];
    let rows;
    switch (from) {
      case "campaign":
        rows = db.campaigns.filter(live).map((c) => {
          const b = byRn(db.budgets, c.budget);
          return { campaign: { ...campRow(c), biddingStrategyType: c.bst, targetSpend: c.ceiling ? { cpcBidCeilingMicros: c.ceiling } : undefined,
            geoTargetTypeSetting: { positiveGeoTargetType: c.geoType }, networkSettings: { ...c.net }, finalUrlSuffix: c.suffix },
          campaignBudget: { resourceName: b.rn, amountMicros: b.amount, explicitlyShared: b.shared },
          segments: { date: opts.today || "2026-10-20" },
          metrics: { impressions: "120", clicks: "7", costMicros: String(opts.today ? (db.costToday[c.rn] || 0) : 35000000), conversions: 0, conversionsValue: 0,
            searchImpressionShare: 0.0999, searchBudgetLostImpressionShare: 0.1, searchRankLostImpressionShare: 0.8 } };
        });
        break;
      case "ad_group":
        rows = db.adGroups.filter(live).map((g) => ({ adGroup: { resourceName: g.rn, name: g.name, status: g.status }, campaign: campRow(camp(g.campaign)) }));
        break;
      case "ad_group_criterion":
        rows = db.keywords.filter(live).map((k) => ({ adGroupCriterion: { resourceName: k.rn, status: k.status, type: "KEYWORD", negative: false,
          keyword: { text: k.text, matchType: k.match } }, adGroup: { resourceName: k.adGroup }, campaign: campRow(camp(groupCamp(k.adGroup))) }));
        break;
      case "ad_group_ad":
        rows = db.ads.filter(live).map((a) => ({ adGroupAd: { resourceName: a.rn, status: a.status, ad: { type: "RESPONSIVE_SEARCH_AD" } },
          adGroup: { resourceName: a.adGroup }, campaign: campRow(camp(groupCamp(a.adGroup))) }));
        break;
      case "campaign_criterion":
        rows = db.campaignCriteria.filter(live).map((cc) => ({ campaignCriterion: { resourceName: cc.rn, type: cc.type, negative: false,
          location: cc.geo ? { geoTargetConstant: cc.geo } : undefined, language: cc.lang ? { languageConstant: cc.lang } : undefined }, campaign: campRow(camp(cc.campaign)) }));
        break;
      case "shared_set":
        rows = db.sharedSets.map((s) => ({ sharedSet: { resourceName: s.rn, name: s.name, status: s.status, type: "NEGATIVE_KEYWORDS" } }));
        break;
      case "shared_criterion":
        rows = db.sharedCriteria.map((s) => { const set = byRn(db.sharedSets, s.sharedSet); return { sharedCriterion: { resourceName: s.rn, keyword: { text: s.text, matchType: s.match } }, sharedSet: { resourceName: set.rn, name: set.name } }; });
        break;
      case "campaign_shared_set":
        rows = db.campaignSharedSets.map((s) => { const set = byRn(db.sharedSets, s.sharedSet); return { campaignSharedSet: { resourceName: s.rn, status: s.status }, campaign: campRow(camp(s.campaign)), sharedSet: { resourceName: set.rn, name: set.name } }; });
        break;
      case "asset":
        rows = db.assets.map((a) => ({ asset: { resourceName: a.rn, name: a.name, type: a.type } }));
        break;
      case "campaign_asset":
        rows = db.links.filter(live).map((l) => { const a = byRn(db.assets, l.asset); return { campaignAsset: { resourceName: l.rn, fieldType: l.fieldType, status: l.status }, campaign: campRow(camp(l.campaign)), asset: { resourceName: a.rn, name: a.name } }; });
        break;
      case "label":
        rows = db.labels.map((l) => ({ label: { resourceName: l.rn, name: l.name, status: "ENABLED", textLabel: { description: l.description } } }));
        break;
      case "campaign_label":
        rows = db.campaignLabels.filter(live).map((cl) => { const l = byRn(db.labels, cl.label); return { campaignLabel: { resourceName: cl.rn }, campaign: campRow(camp(cl.campaign)), label: { resourceName: l.rn, name: l.name } }; });
        break;
      case "conversion_action":
        rows = db.conversionActions.filter(live).map((a) => ({ conversionAction: { resourceName: a.rn, name: a.name, status: a.status, type: a.type,
          tagSnippets: [{ type: "WEBPAGE", eventSnippet: `gtag('event', 'conversion', {'send_to': 'AW-17000000000/AbCdEf_123'});` }] } }));
        break;
      case "custom_conversion_goal":
        rows = db.customGoals.map((g) => ({ customConversionGoal: { resourceName: g.rn, name: g.name, status: g.status, conversionActions: g.actions } }));
        break;
      case "conversion_goal_campaign_config":
        rows = Object.entries(db.goalConfigs).map(([rn, g]) => ({ conversionGoalCampaignConfig: { resourceName: `customers/${C}/conversionGoalCampaignConfigs/${rn.split("/").pop()}`, campaign: rn, goalConfigLevel: g.level, customConversionGoal: g.goal } }));
        break;
      case "search_term_view":
        rows = [["esim mexico", "Nova | Search | eSIM México"], ["esim sin registro", "Nova | Search | eSIM México"], ["holafly", "Nahui Leads"]].map(([t, n], i) => ({
          searchTermView: { searchTerm: t }, campaign: { name: n }, segments: { date: "2026-10-20" }, metrics: { impressions: "40", clicks: String(5 - i), costMicros: String((5 - i) * 6e6), conversions: 0 } }));
        break;
      default:
        throw new Error(`mock: unhandled FROM ${from}`);
    }
    let i = 0;
    return { hasNext: () => i < rows.length, next: () => rows[i++] };
  }

  const P = !!opts.preview;
  const result = (rn, msgs) => ({ isSuccessful: () => !msgs, getResourceName: () => (msgs ? null : rn), getErrorMessages: () => msgs || [] });

  // Each op returns {rn, apply()} or {fail: msg}. Effects are applied only if the batch commits (and never in Preview).
  function plan(o, temp) {
    const type = Object.keys(o)[0], b = o[type];
    const real = (rn, what) => {
      if (typeof rn === "string" && /\/-\d+$/.test(rn)) {
        if (!temp[rn]) { err(`temp ID ${rn} used before being defined in the batch (${what})`); return null; }
        return temp[rn];
      }
      return rn;
    };
    const newRn = (coll) => `customers/${C}/${coll}/${++db.seq}`;
    const define = (c, coll) => { const rn = newRn(coll); if (c.resourceName) { if (!/\/-\d+$/.test(c.resourceName)) err(`create with non-temp resourceName ${c.resourceName}`); temp[c.resourceName] = rn; } return rn; };
    switch (type) {
      case "campaignBudgetOperation": {
        if (b.create) {
          const rn = define(b.create, "campaignBudgets");
          if (b.create.name) err("budget create with a name (must be unnamed, not shared)");
          return { rn, apply: () => db.budgets.push({ rn, amount: String(b.create.amountMicros), shared: !!b.create.explicitlyShared }) };
        }
        const bud = byRn(db.budgets, b.update.resourceName), owner = db.campaigns.find((c) => c.budget === bud?.rn);
        if (!bud || !isNova(owner?.name)) { err(`budget update outside Nova ${b.update.resourceName}`); return { fail: "bad" }; }
        if (b.updateMask !== "amount_micros") err(`budget mask ${b.updateMask}`);
        return { rn: bud.rn, apply: () => (bud.amount = String(b.update.amountMicros)) };
      }
      case "campaignOperation": {
        if (b.create) {
          const c = b.create, rn = define(c, "campaigns"), budget = real(c.campaignBudget, "campaign budget");
          if (!isNova(c.name)) err(`campaign created without Nova prefix: ${c.name}`);
          if (c.status !== "PAUSED") err(`${c.name}: created ${c.status} (must be PAUSED until targeting exists)`);
          if (c.advertisingChannelType !== "SEARCH") err(`${c.name}: channel ${c.advertisingChannelType}`);
          if (c.networkSettings?.targetGoogleSearch !== true || c.networkSettings?.targetSearchNetwork !== false || c.networkSettings?.targetContentNetwork !== false) err(`${c.name}: networks ${JSON.stringify(c.networkSettings)}`);
          if (c.geoTargetTypeSetting?.positiveGeoTargetType !== "PRESENCE") err(`${c.name}: geo type`);
          if (!c.targetSpend || String(c.targetSpend.cpcBidCeilingMicros) !== "10000000") err(`${c.name}: bidding ${JSON.stringify(c.targetSpend)}`);
          if (c.manualCpc || c.maximizeConversions) err(`${c.name}: wrong bidding strategy`);
          return { rn, apply: () => { db.campaigns.push({ rn, name: c.name, status: c.status, type: "SEARCH", bst: "TARGET_SPEND", ceiling: String(c.targetSpend.cpcBidCeilingMicros),
            geoType: c.geoTargetTypeSetting.positiveGeoTargetType, net: { ...c.networkSettings }, suffix: c.finalUrlSuffix, budget }); db.goalConfigs[rn] = { level: "CUSTOMER", goal: null }; } };
        }
        const c = camp(b.update.resourceName);
        if (!c) { err(`campaign update unknown ${b.update.resourceName}`); return { fail: "bad" }; }
        const mask = b.updateMask.split(",");
        if (isFaro(c.name)) {
          if (b.updateMask !== "status" || b.update.status !== "PAUSED") err(`Faro campaign update other than pause: ${JSON.stringify(b)}`);
        } else if (!isNova(c.name)) { err(`campaign update outside Nova/Faro: ${c.name}`); return { fail: "bad" }; }
        if (opts.failEnable && b.update.status === "ENABLED") return { fail: "mock: enable failed" };
        return { rn: c.rn, apply: () => {
          for (const f of mask) {
            if (f === "status") c.status = b.update.status;
            else if (f === "target_spend.cpc_bid_ceiling_micros") { c.bst = "TARGET_SPEND"; c.ceiling = String(b.update.targetSpend.cpcBidCeilingMicros); }
            else if (f === "geo_target_type_setting.positive_geo_target_type") c.geoType = b.update.geoTargetTypeSetting.positiveGeoTargetType;
            else if (f.startsWith("network_settings.")) c.net = { ...b.update.networkSettings };
            else if (f === "final_url_suffix") c.suffix = b.update.finalUrlSuffix;
            else err(`campaign mask ${f}`);
          }
        } };
      }
      case "campaignCriterionOperation": {
        const c = b.create;
        if (!c) { err("campaign criterion remove"); return { fail: "bad" }; }
        if (/\/-\d+$/.test(c.campaign)) return { fail: "The field's contents don't match another field (temp campaign ID in campaignCriterion)" };
        if (!novaCamp(c.campaign)) { err(`criterion outside Nova ${c.campaign}`); return { fail: "bad" }; }
        if (opts.failTargeting && c.location) return { fail: "mock: location failed" };
        if (c.location && c.location.geoTargetConstant !== "geoTargetConstants/2484") err(`location ${c.location.geoTargetConstant}`);
        if (c.language && c.language.languageConstant !== "languageConstants/1003") err(`language ${c.language.languageConstant}`);
        const rn = newRn("campaignCriteria");
        return { rn, apply: () => db.campaignCriteria.push({ rn, campaign: c.campaign, type: c.location ? "LOCATION" : "LANGUAGE", geo: c.location?.geoTargetConstant, lang: c.language?.languageConstant }) };
      }
      case "adGroupOperation": {
        const c = b.create, campaign = real(c.campaign, "ad group campaign");
        if (!campaign || (!novaCamp(campaign) && !Object.values(temp).includes(campaign))) { err(`ad group outside Nova ${c.campaign}`); return { fail: "bad" }; }
        const rn = define(c, "adGroups");
        return { rn, apply: () => db.adGroups.push({ rn, name: c.name, campaign, status: c.status }) };
      }
      case "adGroupCriterionOperation": {
        const c = b.create, ag = real(c.adGroup, "keyword ad group");
        if (!ag) return { fail: "bad" };
        if (byRn(db.adGroups, ag) && !novaCamp(groupCamp(ag))) { err(`keyword outside Nova ${ag}`); return { fail: "bad" }; }
        if (!["PHRASE", "EXACT"].includes(c.keyword.matchType)) err(`match type ${c.keyword.matchType}`);
        const rn = newRn("adGroupCriteria");
        return { rn, apply: () => db.keywords.push({ rn, adGroup: ag, text: c.keyword.text, match: c.keyword.matchType, status: c.status }) };
      }
      case "adGroupAdOperation": {
        const c = b.create, ag = real(c.adGroup, "ad ad group");
        if (!ag) return { fail: "bad" };
        if (byRn(db.adGroups, ag) && !novaCamp(groupCamp(ag))) { err(`ad outside Nova ${ag}`); return { fail: "bad" }; }
        const rsa = c.ad.responsiveSearchAd;
        if (opts.rejectAd && rsa.headlines.some((h) => h.text === opts.rejectAd)) return { fail: `POLICY_FINDING: ${opts.rejectAd}` };
        const rn = `customers/${C}/adGroupAds/${++db.seq}`;
        return { rn, apply: () => db.ads.push({ rn, adGroup: ag, status: c.status, finalUrls: c.ad.finalUrls, headlines: rsa.headlines, descriptions: rsa.descriptions, path1: rsa.path1, path2: rsa.path2 }) };
      }
      case "sharedSetOperation": {
        const c = b.create;
        if (c.name !== "Nova | Negatives") err(`shared set ${c.name}`);
        const rn = define(c, "sharedSets");
        return { rn, apply: () => db.sharedSets.push({ rn, name: c.name, status: "ENABLED" }) };
      }
      case "sharedCriterionOperation": {
        const c = b.create, set = real(c.sharedSet, "negative set");
        const s = byRn(db.sharedSets, set);
        if (s && s.name !== "Nova | Negatives") { err(`negative added to ${s.name}`); return { fail: "bad" }; }
        const rn = newRn("sharedCriteria");
        return { rn, apply: () => db.sharedCriteria.push({ rn, sharedSet: set, text: c.keyword.text, match: c.keyword.matchType }) };
      }
      case "campaignSharedSetOperation": {
        const c = b.create;
        if (!novaCamp(c.campaign) || byRn(db.sharedSets, c.sharedSet)?.name !== "Nova | Negatives") { err(`list link ${JSON.stringify(c)}`); return { fail: "bad" }; }
        const rn = newRn("campaignSharedSets");
        return { rn, apply: () => db.campaignSharedSets.push({ rn, campaign: c.campaign, sharedSet: c.sharedSet, status: "ENABLED" }) };
      }
      case "assetOperation": {
        const c = b.create;
        if (!isNova(c.name)) err(`asset without Nova prefix ${c.name}`);
        if (c.sitelinkAsset) {
          const s = c.sitelinkAsset;
          if (clen(s.linkText) > 25 || clen(s.description1) > 35 || clen(s.description2) > 35) err(`sitelink too long ${s.linkText}`);
          if (!c.finalUrls?.[0]?.startsWith(SITE + "/")) err(`sitelink URL ${c.finalUrls}`);
          if (BAD_COPY.test(JSON.stringify(s))) err(`sitelink copy violates policy: ${JSON.stringify(s)}`);
        } else if (c.calloutAsset) {
          if (clen(c.calloutAsset.calloutText) > 25) err(`callout too long ${c.calloutAsset.calloutText}`);
          if (BAD_COPY.test(c.calloutAsset.calloutText)) err(`callout copy violates policy: ${c.calloutAsset.calloutText}`);
        } else err("asset of unknown type");
        const rn = newRn("assets");
        return { rn, apply: () => db.assets.push({ rn, name: c.name, type: c.sitelinkAsset ? "SITELINK" : "CALLOUT", finalUrls: c.finalUrls, sitelinkAsset: c.sitelinkAsset, calloutAsset: c.calloutAsset }) };
      }
      case "campaignAssetOperation": {
        const c = b.create;
        if (!novaCamp(c.campaign)) { err(`asset linked to non-Nova ${c.campaign}`); return { fail: "bad" }; }
        const a = byRn(db.assets, c.asset);
        if (!a || !isNova(a.name)) { err(`link to non-Nova/unknown asset ${c.asset}`); return { fail: "bad" }; }
        if (a.type !== c.fieldType) err(`field type ${c.fieldType} for ${a.type}`);
        const rn = newRn("campaignAssets");
        return { rn, apply: () => db.links.push({ rn, campaign: c.campaign, asset: c.asset, fieldType: c.fieldType, status: "ENABLED" }) };
      }
      case "campaignLabelOperation": {
        const cl = byRn(db.campaignLabels, b.remove);
        if (!cl || !isFaro(camp(cl.campaign)?.name) || byRn(db.labels, cl.label)?.name !== "Faro|freno") {
          // the Nova brake (novaphone-freno.js) also uses this op type
          if (b.create && isNova(camp(b.create.campaign)?.name)) { const rn = newRn("campaignLabels"); return { rn, apply: () => db.campaignLabels.push({ rn, campaign: b.create.campaign, label: b.create.label, status: "ENABLED" }) }; }
          if (cl && isNova(camp(cl.campaign)?.name)) return { rn: cl.rn, apply: () => (cl.status = "REMOVED") };
          err(`label op outside scope ${JSON.stringify(b)}`); return { fail: "bad" };
        }
        return { rn: cl.rn, apply: () => (cl.status = "REMOVED") };
      }
      case "labelOperation": {
        if (b.create) {
          if (b.create.name !== "Nova|freno") err(`unexpected label ${b.create.name}`);
          const rn = newRn("labels");
          return { rn, apply: () => db.labels.push({ rn, name: b.create.name, description: b.create.textLabel?.description }) };
        }
        const l = byRn(db.labels, b.update.resourceName);
        if (l?.name !== "Nova|freno") err(`label update ${l?.name}`);
        return { rn: l.rn, apply: () => (l.description = b.update.textLabel.description) };
      }
      case "conversionActionOperation": {
        const a = byRn(db.conversionActions, b.update?.resourceName);
        if (!a || a.name !== "Compra Faro" || b.updateMask !== "name" || b.update.name !== "Compra") { err(`conversion op ${JSON.stringify(b)}`); return { fail: "bad" }; }
        if (opts.failRename) return { fail: "mock: rename not allowed" };
        return { rn: a.rn, apply: () => (a.name = "Compra") };
      }
      case "customConversionGoalOperation": {
        const c = b.create;
        if (c.name !== "Nova | Compra" || c.conversionActions.length !== 1 || !byRn(db.conversionActions, c.conversionActions[0])) err(`custom goal ${JSON.stringify(c)}`);
        const rn = newRn("customConversionGoals");
        return { rn, apply: () => db.customGoals.push({ rn, name: c.name, status: "ENABLED", actions: c.conversionActions }) };
      }
      case "conversionGoalCampaignConfigOperation": {
        const id = b.update.resourceName.split("/").pop();
        const c = db.campaigns.find((x) => x.rn.split("/").pop() === id);
        if (!c || !isNova(c.name)) { err(`goal config outside Nova ${b.update.resourceName}`); return { fail: "bad" }; }
        if (!db.customGoals.some((g) => g.rn === b.update.customConversionGoal && g.name === "Nova | Compra")) err(`goal config to wrong goal ${b.update.customConversionGoal}`);
        return { rn: b.update.resourceName, apply: () => (db.goalConfigs[c.rn] = { level: b.update.goalConfigLevel, goal: b.update.customConversionGoal }) };
      }
    }
    err(`unexpected operation ${type} ${JSON.stringify(b).slice(0, 200)}`);
    return { fail: "unexpected" };
  }

  function mutateAll(ops, options) {
    calls.push({ ops, options });
    if (!options || typeof options.partialFailure !== "boolean") err("mutateAll without explicit partialFailure");
    if (ops.length > 1000) err(`batch of ${ops.length} ops`);
    const atomic = !options.partialFailure;
    const temp = {};
    const planned = ops.map((o) => plan(o, temp));
    const anyFail = planned.some((p) => p.fail);
    if (!P && !(atomic && anyFail)) planned.forEach((p) => p.apply && p.apply());
    const failed = { isSuccessful: () => false, getResourceName: () => null, getErrorMessages: () => [] };
    return planned.map((p, i) => {
      if (p.fail) return result(null, [p.fail]);
      if (atomic && anyFail) return failed;
      const isCreate = !!ops[i][Object.keys(ops[i])[0]].create;
      return result(P && isCreate ? String(p.rn).replace(/\/(\d+)$/, "/90$1") : p.rn); // Preview: IDs of new entities are not real
    });
  }
  const AdsApp = {
    currentAccount: () => ({ getCustomerId: () => "823-438-8697", getCurrencyCode: () => opts.currency || "MXN", getTimeZone: () => "America/Mexico_City" }),
    getExecutionInfo: () => ({ isPreview: () => P }),
    search,
    mutateAll,
  };
  const Utilities = { formatDate: (d) => opts.today || "2026-10-20" };
  return { AdsApp, Utilities, Logger: { log: (s) => logs.push(String(s)) }, logs, calls, queries };
}

function run(db, opts = {}) {
  const env = makeEnv(db, opts);
  let src = opts.src || SCRIPT;
  if (opts.dryRun) src = src.replace("var DRY_RUN = false;", "var DRY_RUN = true;");
  if (opts.phase) src = src.replace(/var PHASE = \d;/, `var PHASE = ${opts.phase};`);
  if (opts.patch) src = opts.patch(src);
  try {
    vm.runInContext(src + "\nmain();", vm.createContext({ AdsApp: env.AdsApp, Logger: env.Logger, Utilities: env.Utilities }), { filename: opts.file || "novaphone-ads.js", timeout: 20000 });
  } catch (e) {
    err(`[${opts.name}] JS error: ${e.stack || e}`);
  }
  if (opts.print) console.log(env.logs.join("\n"));
  return { ...env, ops: env.calls.flatMap((c) => c.ops) };
}

const snapDb = (db) => JSON.stringify({ ...db, seq: 0 });
const nahui = (db) => {
  const nc = db.campaigns.find((c) => c.name === "Nahui Leads");
  return JSON.stringify([nc, db.budgets.find((b) => b.rn === nc.budget), db.adGroups.filter((g) => g.campaign === nc.rn), db.keywords.filter((k) => db.adGroups.find((g) => g.rn === k.adGroup)?.campaign === nc.rn),
    db.campaignCriteria.filter((c) => c.campaign === nc.rn), db.goalConfigs[nc.rn]]);
};
const faroNonStatus = (db) => JSON.stringify([db.campaigns.filter((c) => isFaro(c.name)).map(({ status, ...c }) => c), db.budgets.filter((b) => db.campaigns.some((c) => isFaro(c.name) && c.budget === b.rn)),
  db.adGroups.filter((g) => isFaro(db.campaigns.find((c) => c.rn === g.campaign)?.name)), db.keywords.filter((k) => isFaro(db.campaigns.find((c) => c.rn === db.adGroups.find((g) => g.rn === k.adGroup)?.campaign)?.name)),
  db.sharedSets.filter((s) => /Faro/.test(s.name)), db.sharedCriteria.filter((s) => db.sharedSets.find((x) => x.rn === s.sharedSet)?.name === "Faro | Negatives"),
  db.assets.filter((a) => isFaro(a.name)), db.customGoals.filter((g) => /Faro/.test(g.name))]);
const nova = (db) => db.campaigns.filter((c) => isNova(c.name));
const novaByName = (db, n) => db.campaigns.find((c) => c.name === n);

function checkFinal(db, tag, phase = 1) {
  // Faro
  for (const c of db.campaigns.filter((x) => isFaro(x.name))) if (c.status !== "PAUSED") err(`${tag}: ${c.name} is ${c.status}`);
  if (db.campaignLabels.some((cl) => cl.status !== "REMOVED" && isFaro(db.campaigns.find((c) => c.rn === cl.campaign)?.name))) err(`${tag}: Faro|freno label left on a Faro campaign`);
  // Nova campaigns
  const names = nova(db).map((c) => c.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(PLAN).sort())) err(`${tag}: Nova campaigns = ${names.join(", ")}`);
  let sum = 0;
  for (const [name, p] of Object.entries(PLAN)) {
    const c = novaByName(db, name);
    if (!c) continue;
    const b = db.budgets.find((x) => x.rn === c.budget);
    if (Number(b.amount) !== PHASES[phase][p.key] * 1e6) err(`${tag}: ${name} budget ${b.amount} (fase ${phase})`);
    if (c.status !== "ENABLED") err(`${tag}: ${name} is ${c.status}`); else sum += Number(b.amount) / 1e6;
    if (c.bst !== "TARGET_SPEND" || c.ceiling !== "10000000") err(`${tag}: ${name} bidding ${c.bst} ${c.ceiling}`);
    if (c.geoType !== "PRESENCE") err(`${tag}: ${name} geo type ${c.geoType}`);
    if (c.net.targetSearchNetwork !== false || c.net.targetContentNetwork !== false || c.net.targetGoogleSearch !== true) err(`${tag}: ${name} networks`);
    if (c.suffix !== `utm_source=google&utm_medium=cpc&utm_campaign=${p.slug}&utm_term={keyword}`) err(`${tag}: ${name} suffix ${c.suffix}`);
    const crit = db.campaignCriteria.filter((x) => x.campaign === c.rn && x.status !== "REMOVED");
    if (JSON.stringify(crit.filter((x) => x.type === "LOCATION").map((x) => x.geo)) !== '["geoTargetConstants/2484"]') err(`${tag}: ${name} locations`);
    if (JSON.stringify(crit.filter((x) => x.type === "LANGUAGE").map((x) => x.lang)) !== '["languageConstants/1003"]') err(`${tag}: ${name} languages`);
    const set = db.sharedSets.find((s) => s.name === "Nova | Negatives");
    if (!set || !db.campaignSharedSets.some((s) => s.campaign === c.rn && s.sharedSet === set.rn)) err(`${tag}: ${name} lacks Nova | Negatives`);
    if (db.campaignSharedSets.some((s) => s.campaign === c.rn && db.sharedSets.find((x) => x.rn === s.sharedSet)?.name !== "Nova | Negatives")) err(`${tag}: ${name} linked to a non-Nova list`);
    const linked = db.links.filter((l) => l.campaign === c.rn).map((l) => db.assets.find((a) => a.rn === l.asset));
    const sl = linked.filter((a) => a.type === "SITELINK").map((a) => a.sitelinkAsset.linkText).sort();
    if (JSON.stringify(sl) !== JSON.stringify([...SITELINK_TEXTS].sort())) err(`${tag}: ${name} sitelinks ${sl}`);
    if (linked.filter((a) => a.type === "CALLOUT").length < 4) err(`${tag}: ${name} has < 4 callouts`);
    if (linked.some((a) => !isNova(a.name))) err(`${tag}: ${name} has a non-Nova asset`);
    // groups, keywords, ads
    const groups = db.adGroups.filter((g) => g.campaign === c.rn);
    if (JSON.stringify(groups.map((g) => g.name).sort()) !== JSON.stringify(Object.keys(p.groups).sort())) err(`${tag}: ${name} groups ${groups.map((g) => g.name)}`);
    for (const g of groups) {
      const kws = db.keywords.filter((k) => k.adGroup === g.rn).map((k) => `${k.text}|${k.match}`).sort();
      const want = (p.groups[g.name] || []).flatMap((t) => [`${t}|EXACT`, `${t}|PHRASE`]).sort();
      if (JSON.stringify(kws) !== JSON.stringify(want)) err(`${tag}: ${name} > ${g.name} keywords ${kws.join(", ")}`);
      const ads = db.ads.filter((a) => a.adGroup === g.rn);
      if (ads.length !== 1) { err(`${tag}: ${name} > ${g.name} has ${ads.length} RSAs`); continue; }
      const a = ads[0];
      if (a.headlines.length < 3 || a.headlines.length > 15) err(`${tag}: ${g.name} ${a.headlines.length} headlines`);
      if (a.descriptions.length < 2 || a.descriptions.length > 4) err(`${tag}: ${g.name} ${a.descriptions.length} descriptions`);
      for (const h of a.headlines) { if (clen(h.text) > 30) err(`${tag}: headline > 30: "${h.text}" (${clen(h.text)})`); if (BAD_COPY.test(h.text)) err(`${tag}: headline violates policy "${h.text}"`); }
      for (const d of a.descriptions) { if (clen(d.text) > 90) err(`${tag}: description > 90: "${d.text}" (${clen(d.text)})`); if (BAD_COPY.test(d.text)) err(`${tag}: description violates policy "${d.text}"`); }
      if (new Set(a.headlines.map((h) => norm(h.text))).size !== a.headlines.length) err(`${tag}: duplicate headlines in ${g.name}`);
      for (const h of MUST_HEADLINES) if (!a.headlines.some((x) => x.text === h)) err(`${tag}: ${g.name} lacks headline "${h}"`);
      const pinned = a.descriptions.filter((d) => d.pinnedField);
      if (pinned.length !== 1 || pinned[0].pinnedField !== "DESCRIPTION_1" || !/^Solo datos, sin número/.test(pinned[0].text)) err(`${tag}: ${g.name} pinned description ${JSON.stringify(pinned)}`);
      if ((a.path1 && clen(a.path1) > 15) || (a.path2 && clen(a.path2) > 15)) err(`${tag}: path too long`);
      if (!["https://novaphone.lat/", "https://novaphone.lat/planes"].includes(a.finalUrls[0])) err(`${tag}: ${g.name} final URL ${a.finalUrls}`);
      if (g.name === "eSIM sin contrato" && a.finalUrls[0] !== "https://novaphone.lat/") err(`${tag}: "sin registro" intent must land on the home page (FAQ with the legal status)`);
    }
    // goal
    const goal = db.customGoals.find((g) => g.name === "Nova | Compra");
    if (db.conversionActions.length && (!goal || db.goalConfigs[c.rn]?.level !== "CAMPAIGN" || db.goalConfigs[c.rn]?.goal !== goal.rn)) err(`${tag}: ${name} goal config ${JSON.stringify(db.goalConfigs[c.rn])}`);
  }
  if (sum !== PHASES[phase].total) err(`${tag}: enabled Nova budgets sum to ${sum} (fase ${phase} = ${PHASES[phase].total})`);
  // negatives
  const set = db.sharedSets.find((s) => s.name === "Nova | Negatives");
  const negs = set ? db.sharedCriteria.filter((s) => s.sharedSet === set.rn) : [];
  if (JSON.stringify(negs.map((n) => n.text).sort()) !== JSON.stringify([...NEGS].sort()) || negs.some((n) => n.match !== "PHRASE")) err(`${tag}: negatives ${negs.map((n) => n.text)}`);
  if (negs.some((n) => /^registro$|^curp$/.test(n.text))) err(`${tag}: "registro" must not be a negative`);
  const kwTexts = db.keywords.filter((k) => isNova(db.campaigns.find((c) => c.rn === db.adGroups.find((g) => g.rn === k.adGroup)?.campaign)?.name)).map((k) => norm(k.text));
  for (const n of negs) for (const t of kwTexts) if ((` ${t} `).includes(` ${norm(n.text)} `)) err(`${tag}: negative "${n.text}" blocks "${t}"`);
}

console.log("validate-novaphone-ads:");

// 1. Fresh run + 2. idempotent re-run
{
  const db = newDb();
  const nh = nahui(db), faroSnap = faroNonStatus(db);
  const r = run(db, { name: "fresh" });
  if (!r.logs.some((l) => /PLAN · FASE 1: MXN 150\/día/.test(l))) err("fresh: no plan summary");
  checkFinal(db, "fresh");
  if (db.conversionActions[0].name !== "Compra") err(`fresh: conversion not renamed (${db.conversionActions[0].name})`);
  if (!r.logs.some((l) => /NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL=AbCdEf_123/.test(l))) err("fresh: send_to not printed");
  if (nahui(db) !== nh) err("fresh: NON-Faro/NON-Nova campaign changed");
  if (faroNonStatus(db) !== faroSnap) err("fresh: something other than the status of Faro campaigns changed");
  if (r.logs.some((l) => /FAIL|ABORTADO|ERRORES/.test(l))) err(`fresh: ${r.logs.filter((l) => /FAIL|ABORTADO|ERRORES/.test(l)).join(" / ")}`);
  const n = (re) => r.ops.filter((o) => re.test(Object.keys(o)[0])).length;
  ok(`fresh: ${r.ops.length} ops in ${r.calls.length} batches (${n(/^campaignOperation/)} campaign ops, ${n(/adGroupOperation/)} ad groups, ${n(/adGroupCriterion/)} keywords, ` +
    `${n(/adGroupAd/)} RSAs, ${n(/sharedCriterion/)} negatives, ${n(/^assetOperation/)} assets, ${n(/campaignAsset/)} asset links); 8 Faro paused; final state = plan; Nahui untouched`);
  const r2 = run(db, { name: "rerun" });
  if (r2.calls.length) err(`rerun: expected no mutateAll, got ${r2.ops.length} ops: ${JSON.stringify(r2.ops[0]).slice(0, 200)}`);
  if (!r2.logs.some((l) => /Nada que cambiar/.test(l))) err("rerun: missing 'Nada que cambiar'");
  ok("re-run: 0 operations, prints 'Nada que cambiar'");
  // somebody re-enables a Faro campaign by hand (or re-runs optimize-2): the next run pauses it again and nothing else
  db.campaigns.find((c) => c.name === "Faro | Search | Countries | ES").status = "ENABLED";
  const r3 = run(db, { name: "faro-back" });
  if (r3.ops.length !== 1 || !r3.ops[0].campaignOperation) err(`faro-back: expected 1 pause op, got ${r3.ops.length}`);
  checkFinal(db, "faro-back");
  ok("a re-enabled Faro campaign is paused again (1 op)");
}
// 3. Preview
{
  const db = newDb();
  const before = snapDb(db);
  const r = run(db, { name: "preview", preview: true });
  const after = JSON.parse(snapDb(db)), b = JSON.parse(before);
  if (JSON.stringify({ ...after, seq: 0 }) !== JSON.stringify({ ...b, seq: 0 })) err("preview: account changed");
  if (!r.logs.some((l) => /VISTA PREVIA: Google solo simuló/.test(l))) err("preview: missing preview notice");
  if (!r.logs.some((l) => /diferid/.test(l))) err("preview: dependent steps should be reported as deferred");
  if (r.ops.some((o) => o.campaignCriterionOperation || o.campaignAssetOperation)) err("preview: used a preview (non-real) campaign ID");
  ok(`preview: ${r.ops.length} simulated operations, account unchanged, dependent steps deferred`);
}
// 4. DRY_RUN
{
  const db = newDb();
  const before = snapDb(db);
  const r = run(db, { name: "dry", dryRun: true });
  if (r.calls.length) err("dry run: mutateAll was called");
  if (snapDb(db) !== before) err("dry run: account changed");
  if (!r.logs.some((l) => /\(dry run\)/.test(l))) err("dry run: plan not printed");
  ok("DRY_RUN: plan printed, no mutateAll");
}
// 5. Phase ramp
{
  const db = newDb();
  run(db, { name: "ph1" });
  for (const ph of [2, 3]) {
    const r = run(db, { name: `ph${ph}`, phase: ph });
    const other = r.ops.filter((o) => !o.campaignBudgetOperation);
    if (other.length) err(`phase${ph}: ${other.length} non-budget ops: ${JSON.stringify(other[0]).slice(0, 160)}`);
    if (r.ops.length !== 3) err(`phase${ph}: expected 3 budget ops, got ${r.ops.length}`);
    checkFinal(db, `phase${ph}`, ph);
    const again = run(db, { name: `ph${ph}b`, phase: ph });
    if (again.calls.length) err(`phase${ph}: re-run not idempotent`);
  }
  const bad = run(newDb(), { name: "ph9", phase: 9 });
  if (bad.calls.length || !bad.logs.some((l) => /ABORTADO/.test(l))) err("phase 9 should abort");
  ok("PHASE 1 -> 2 -> 3: only 3 budget ops each (150 -> 280 -> 330/day), idempotent; invalid PHASE aborts");
}
// 6. Copy guard: forbidden or too-long text aborts before touching the account
{
  const cases = [
    ["registro promise", (s) => s.replace("'Sin chip físico',", "'eSIM sin registro de CURP',")],
    ["headline > 30", (s) => s.replace("'Sin chip físico',", "'eSIM de datos para todo México hoy',")],
    ["description > 90", (s) => s.replace("Revisa si tu teléfono tiene eSIM antes de comprar. Garantía de conexión.", "Revisa si tu teléfono tiene eSIM antes de comprar. Garantía de conexión. Soporte por correo los 7 días.")],
    ["callout", (s) => s.replace("'Sin contrato', 'Red Telcel 5G'", "'Sin papeleo', 'Red Telcel 5G'")],
    ["negative blocks keyword", (s) => s.replace("'pospago', 'factura',", "'pospago', 'factura', 'tablet',")],
    ["URL outside site", (s) => s.replace("url: SITE + '/planes', path1: 'esim', path2: 'mexico'", "url: 'https://faroesim.com/es', path1: 'esim', path2: 'mexico'")],
  ];
  for (const [name, patch] of cases) {
    const db = newDb(), before = snapDb(db);
    const src = patch(SCRIPT);
    if (src === SCRIPT) { err(`copy guard "${name}": patch did not apply`); continue; }
    const r = run(db, { name, patch: () => src });
    if (r.calls.length || snapDb(db) !== before || !r.logs.some((l) => /ABORTADO/.test(l))) err(`copy guard "${name}": did not abort`);
  }
  ok(`copy guard: ${cases.length} bad edits (registro/CURP promise, >30, >90, "sin papeleo", self-blocking negative, foreign URL) abort with 0 mutations`);
}
// 7. Targeting failure: the campaign is never enabled without Mexico; a re-run fixes it
{
  const db = newDb();
  const r = run(db, { name: "no-mx", failTargeting: true });
  for (const c of nova(db)) {
    if (c.status !== "PAUSED") err(`no-mx: ${c.name} enabled without Mexico`);
  }
  if (!r.logs.some((l) => /NO se activa/.test(l))) err("no-mx: no warning");
  run(db, { name: "no-mx-fix" });
  checkFinal(db, "no-mx-fix");
  ok("location failure: Nova campaigns stay PAUSED (never worldwide); the next run adds Mexico and enables them");
}
// 8. One ad rejected by policy: the rest is created, the ad is retried on its own
{
  const db = newDb();
  const r = run(db, { name: "reject", rejectAd: "eSIM de datos red Telcel 5G" });
  const tc = novaByName(db, "Nova | Search | Telcel/Chip virtual");
  if (!tc || tc.status !== "ENABLED") err("reject: Telcel campaign not created/enabled after ad rejection");
  const g = db.adGroups.find((x) => x.campaign === tc?.rn && x.name === "eSIM Telcel");
  if (!g || db.ads.some((a) => a.adGroup === g.rn)) err("reject: rejected ad should be missing");
  if (!r.logs.some((l) => /reintento sin anuncios/.test(l))) err("reject: no retry log");
  const chip = db.adGroups.find((x) => x.campaign === tc?.rn && x.name === "Chip virtual");
  if (!chip || db.ads.filter((a) => a.adGroup === chip.rn).length !== 1) err("reject: sibling ad not created");
  ok("rejected ad: campaign + keywords created, sibling ad created, the rejected one reported (FAIL) for the director");
}
// 9. Nova brake: a Nova campaign braked today stays paused
{
  const db = newDb();
  run(db, { name: "pre" });
  const c = novaByName(db, "Nova | Search | eSIM México");
  c.status = "PAUSED";
  db.labels.push({ rn: `customers/${C}/labels/7`, name: "Nova|freno", description: "2026-10-20" });
  db.campaignLabels.push({ rn: `customers/${C}/campaignLabels/7`, campaign: c.rn, label: `customers/${C}/labels/7`, status: "ENABLED" });
  const r = run(db, { name: "nova-freno" });
  if (c.status !== "PAUSED" || r.calls.length) err(`nova-freno: touched a braked Nova campaign (${r.ops.length} ops)`);
  ok("novaphone-ads.js leaves Nova campaigns paused by the brake alone");
}
// 10. Conversion variants
{
  let db = newDb({ conversion: "compra" });
  let r = run(db, { name: "conv-exists" });
  if (r.ops.some((o) => o.conversionActionOperation)) err("conv-exists: renamed although 'Compra' exists");
  checkFinal(db, "conv-exists");
  db = newDb({ conversion: "none" });
  r = run(db, { name: "conv-none" });
  if (r.ops.some((o) => o.conversionActionOperation || o.customConversionGoalOperation)) err("conv-none: created conversion stuff");
  if (!r.logs.some((l) => /No existe "Compra"/.test(l))) err("conv-none: no warning");
  checkFinal(db, "conv-none");
  db = newDb();
  r = run(db, { name: "conv-rename-fails", failRename: true });
  if (!r.logs.some((l) => /No se pudo renombrar/.test(l))) err("conv-rename-fails: no warning");
  if (!db.customGoals.some((g) => g.name === "Nova | Compra" && g.actions[0] === db.conversionActions[0].rn)) err("conv-rename-fails: goal not created with 'Compra Faro'");
  ok("conversion: rename 'Compra Faro' -> 'Compra'; 'Compra' already there = no rename; none = warning only; rename refused = uses 'Compra Faro'");
}
// 11. Wrong currency aborts
{
  const db = newDb(), before = snapDb(db);
  const r = run(db, { name: "usd", currency: "USD" });
  if (r.calls.length || snapDb(db) !== before || !r.logs.some((l) => /ABORTADO/.test(l))) err("usd: should abort");
  ok("non-MXN account aborts");
}
// 12. Nova brake script
{
  const db = newDb();
  run(db, { name: "setup" });
  const nh = nahui(db), faroSnap = JSON.stringify(db.campaigns.filter((c) => isFaro(c.name)));
  const active = nova(db).filter((c) => c.status === "ENABLED");
  const budget = active.reduce((n, c) => n + Number(db.budgets.find((b) => b.rn === c.budget).amount), 0);
  const F = (name, today, extra = {}) => run(db, { name, src: FRENO, file: "novaphone-freno.js", today, ...extra });
  active.forEach((c) => (db.costToday[c.rn] = Math.floor(budget / active.length)));
  db.campaigns.filter((c) => isFaro(c.name) || c.name === "Nahui Leads").forEach((c) => (db.costToday[c.rn] = 10 * budget));
  let r = F("freno-under", "2026-10-21");
  if (r.ops.length || !r.logs.some((l) => /Nada que cambiar/.test(l))) err("freno-under: should do nothing (Faro/Nahui cost must not count)");
  active.forEach((c) => (db.costToday[c.rn] = Math.ceil((budget * 1.15) / active.length) + 1));
  const snap = snapDb(db);
  F("freno-preview", "2026-10-21", { preview: true });
  if (snapDb(db) !== snap) err("freno-preview: account changed");
  F("freno-over", "2026-10-21");
  for (const c of active) if (c.status !== "PAUSED") err(`freno-over: ${c.name} not paused`);
  r = F("freno-over-again", "2026-10-21");
  if (r.ops.length) err(`freno-over-again: not idempotent (${r.ops.length} ops)`);
  db.costToday = {};
  F("freno-nextday", "2026-10-22");
  for (const c of active) if (c.status !== "ENABLED") err(`freno-nextday: ${c.name} not re-enabled`);
  if (JSON.stringify(db.campaigns.filter((c) => isFaro(c.name))) !== faroSnap) err("freno: touched Faro campaigns");
  if (nahui(db) !== nh) err("freno: touched Nahui");
  const r2 = run(db, { name: "after-freno" });
  if (r2.calls.length) err("after-freno: novaphone-ads.js not idempotent after the brake cycle");
  ok("Nova brake: Faro/Nahui cost ignored; preview safe; over 1.15× pauses Nova only (idempotent); next day re-enables; Faro never touched");
}
// 13. Report (read-only, both brands)
{
  const db = newDb();
  run(db, { name: "setup-report" });
  db.campaigns.find((c) => c.name === "Faro | Search | Countries | ES").status = "ENABLED"; // must raise an ALERTA
  const before = snapDb(db);
  const r = run(db, { name: "report", src: REPORT, file: "google-ads-report.js" });
  if (r.calls.length) err("report: called mutateAll");
  if (snapDb(db) !== before) err("report: account changed");
  for (const re of [/AYER/, /ÚLTIMOS 7 DÍAS/, /Top 40 términos/, /TOTAL Nova \|/, /TOTAL Faro \|/, /Nova · eSIM México/, /ALERTA: 1 campaña\(s\) Faro ACTIVA/, /PLAN NOVA 21 DÍAS/, /próxima compuerta/, /FIN DEL REPORTE/])
    if (!r.logs.some((l) => re.test(l))) err(`report: missing ${re}`);
  if (r.logs.some((l) => /Nahui|holafly/.test(l))) err("report: non-Faro/Nova campaign in output");
  ok(`report: read-only, ${r.queries.length} queries, ${r.logs.length} log lines, shows Nova + Faro and alerts on an active Faro campaign`);
}

done = true;

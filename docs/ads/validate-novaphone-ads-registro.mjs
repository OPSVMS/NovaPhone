#!/usr/bin/env node
// Runs docs/ads/novaphone-ads-registro.js inside a Node vm against a mocked account 823-438-8697 in the state that
// novaphone-ads.js leaves it (3 Nova campaigns with their groups/keywords/RSAs, "Nova | Negatives" linked), plus Faro
// campaigns (one of them with its own "Sin registro" group) and "Nahui Leads", which must never be touched.
//
//   node docs/ads/validate-novaphone-ads-registro.mjs        (exit 1 on any error)
//
// Scenarios: fresh run, idempotent re-run, Preview, DRY_RUN, partial state (paused group, missing keyword, wrong suffix,
// paused ad), forbidden/too-long copy aborts, prerequisites missing abort, a live negative that would block a keyword
// aborts, rejected ad retried alone, non-MXN aborts. Checks: no JS errors, GAQL WHERE fields are SELECTed, char limits,
// banned words, pin, path, URL, suffix, inherited bid, only "Sin registro" / "Nova | Negatives" ops.
// Prints the policy check of every ad line at the end.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = readFileSync(join(HERE, "novaphone-ads-registro.js"), "utf8");
const errors = [];
const err = (m) => errors.push(m);
const ok = (m) => console.log(`  ok  ${m}`);
let done = false;
process.on("exit", (code) => {
  for (const e of errors) console.error(`ERROR ${e}`);
  if (!done) console.error("validate-novaphone-ads-registro: aborted by an exception (see above)");
  if (errors.length || !done) { console.error(`${errors.length} error(s).`); process.exitCode = 1; return; }
  if (code === 0) console.log("validate-novaphone-ads-registro: all checks passed");
});

const C = "8234388697";
const CAMPAIGN = "Nova | Search | eSIM México";
const GROUP = "Sin registro";
const SUFFIX = "utm_source=google&utm_medium=cpc&utm_campaign=esim-mexico&utm_term={keyword}";
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const clen = (s) => [...String(s)].length;
const isNova = (n) => /^nova \| /i.test(n || "");

// ----------------------------------------------------------------------------- Expected plan (independent copy)
const PHRASE = ["sim sin registro", "sim sin registro en mexico", "sim sin registro de curp", "e sim sin registro", "esim sin registro méxico",
  "e sim sin registro de curp", "chip sin registro telcel", "sim virtual sin registro", "chip sim sin registro", "sim internacional sin registro",
  "compañías telefónicas que no piden registro en méxico"];
const EXACT = ["esim sin registro", "sim sin registro", "sim sin registro en mexico", "esim sin registro mexico"];
const WANT_KW = [...PHRASE.map((t) => `${t}|PHRASE`), ...EXACT.map((t) => `${t}|EXACT`)].sort();
const NEW_NEGS = ["mercado libre", "altan", "altán", "telcel app"];
// Independent policy filter (POLICY.md §5.1): stricter than the script's — any registro/CURP/INE/anonymity/evasion/legal claim.
const BAD_COPY = /registr|curp|\bine\b|an[oó]nim|identific|document|papeleo|evita|evade|evas|elud|esquiv|rastr|privad|legal|exent|suspen|vincul|permanente|para siempre|ilimitad|gratis|whatsapp|\+44|100\s*%|!|\{/i;
const MAIN_NEGS = ["gratis", "free", "hack", "clonar", "personal", "activar", "como registrar", "registrar mi", "registro de telefonia", "ift", "crt", "ley",
  "multa", "imei", "liberar", "desbloquear", "telcel app", "mi telcel", "recarga telcel", "saldo telcel", "amigo sin limite", "iphone precio",
  "plan tarifario", "pospago", "factura"];

// ----------------------------------------------------------------------------- Mock account (post novaphone-ads.js)
function newDb(variant = {}) {
  let seq = 100;
  const id = (coll) => `customers/${C}/${coll}/${++seq}`;
  const db = { seq: 10000, campaigns: [], adGroups: [], keywords: [], ads: [], sharedSets: [], sharedCriteria: [], campaignSharedSets: [] };
  const camp = (name, status = "ENABLED", bst = "TARGET_SPEND") => { const c = { rn: id("campaigns"), name, status, type: "SEARCH", bst }; db.campaigns.push(c); return c; };
  const group = (c, name, kws, status = "ENABLED", suffix = "") => {
    const g = { rn: id("adGroups"), name, campaign: c.rn, status, suffix };
    db.adGroups.push(g);
    for (const t of kws) for (const m of ["PHRASE", "EXACT"]) db.keywords.push({ rn: id("adGroupCriteria"), adGroup: g.rn, text: t, match: m, status: "ENABLED" });
    db.ads.push({ rn: id("adGroupAds"), adGroup: g.rn, status: "ENABLED", finalUrls: ["https://novaphone.lat/"] });
    return g;
  };
  const nahui = camp("Nahui Leads", "ENABLED", "MANUAL_CPC");
  group(nahui, "Nahui AG", ["esim mexico"]);
  const faro = camp("Faro | Search | Countries | ES", "PAUSED");
  group(faro, "Sin registro", ["esim sin registro"]);
  if (variant.campaign !== "none") {
    const e = camp(CAMPAIGN, variant.campaignStatus || "ENABLED");
    group(e, "eSIM México", ["esim mexico", "esim en mexico", "comprar esim mexico", "esim prepago mexico"]);
    group(e, "eSIM de datos", ["esim de datos", "esim solo datos", "esim para tablet", "internet para celular prepago"]);
    group(e, "eSIM sin contrato", ["esim sin registro", "esim sin contrato"]);
  }
  const t = camp("Nova | Search | Telcel/Chip virtual");
  group(t, "eSIM Telcel", ["esim telcel"]);
  group(t, "Chip virtual", ["chip virtual mexico", "chip virtual telcel"]);
  const b = camp("Nova | Search | Brand");
  group(b, "NovaPhone", ["novaphone", "nova phone", "novaphone esim"]);
  const fset = { rn: id("sharedSets"), name: "Faro | Negatives", status: "ENABLED" };
  db.sharedSets.push(fset);
  db.sharedCriteria.push({ rn: id("sharedCriteria"), sharedSet: fset.rn, text: "gratis", match: "PHRASE" });
  if (variant.negList !== "none") {
    const set = { rn: id("sharedSets"), name: "Nova | Negatives", status: "ENABLED" };
    db.sharedSets.push(set);
    for (const n of MAIN_NEGS.concat(variant.extraNegs || [])) db.sharedCriteria.push({ rn: id("sharedCriteria"), sharedSet: set.rn, text: n, match: "PHRASE" });
    for (const c of db.campaigns.filter((x) => isNova(x.name))) db.campaignSharedSets.push({ rn: id("campaignSharedSets"), campaign: c.rn, sharedSet: set.rn, status: "ENABLED" });
  }
  return db;
}

function makeEnv(db, opts = {}) {
  const logs = [], calls = [], queries = [];
  const byRn = (list, rn) => list.find((x) => x.rn === rn);
  const camp = (rn) => byRn(db.campaigns, rn);
  const groupCamp = (agRn) => byRn(db.adGroups, agRn)?.campaign;
  const live = (x) => x.status !== "REMOVED";
  const target = () => db.campaigns.find((c) => c.name === CAMPAIGN);

  function checkGaql(q) {
    const m = /^\s*SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)([\s\S]*)$/i.exec(q);
    if (!m) return err(`malformed GAQL: ${q}`);
    const fields = m[1].split(",").map((f) => f.trim());
    const where = /\bWHERE\b([\s\S]*?)(\bORDER BY\b|\bLIMIT\b|$)/i.exec(m[3]);
    if (where) for (const ref of where[1].replace(/'(?:[^'\\]|\\.)*'/g, "").match(/\b[a-z_]+(?:\.[a-z_0-9]+)+\b/g) || []) if (!fields.includes(ref)) err(`GAQL WHERE field ${ref} not in SELECT: ${q.slice(0, 160)}`);
    for (const f of fields) if (!/^[a-z_]+(\.[a-z_0-9]+)+$/.test(f)) err(`GAQL odd field "${f}"`);
  }
  const campRow = (c) => ({ resourceName: c.rn, name: c.name, status: c.status, advertisingChannelType: c.type, biddingStrategyType: c.bst });
  function search(q) {
    queries.push(q);
    checkGaql(q);
    const from = (q.match(/FROM\s+(\w+)/) || [])[1];
    let rows;
    // WHERE is not evaluated: the script must re-filter every row itself.
    switch (from) {
      case "campaign": rows = db.campaigns.filter(live).map((c) => ({ campaign: campRow(c) })); break;
      case "ad_group": rows = db.adGroups.filter(live).map((g) => ({ adGroup: { resourceName: g.rn, name: g.name, status: g.status, finalUrlSuffix: g.suffix }, campaign: campRow(camp(g.campaign)) })); break;
      case "ad_group_criterion": rows = db.keywords.filter(live).map((k) => { const g = byRn(db.adGroups, k.adGroup); return { adGroupCriterion: { resourceName: k.rn, status: k.status, type: "KEYWORD", negative: false, keyword: { text: k.text, matchType: k.match } }, adGroup: { resourceName: g.rn, name: g.name }, campaign: campRow(camp(g.campaign)) }; }); break;
      case "ad_group_ad": rows = db.ads.filter(live).map((a) => ({ adGroupAd: { resourceName: a.rn, status: a.status, ad: { type: "RESPONSIVE_SEARCH_AD" } }, adGroup: { resourceName: a.adGroup } })); break;
      case "shared_set": rows = db.sharedSets.map((s) => ({ sharedSet: { resourceName: s.rn, name: s.name, status: s.status, type: "NEGATIVE_KEYWORDS" } })); break;
      case "shared_criterion": rows = db.sharedCriteria.map((s) => { const set = byRn(db.sharedSets, s.sharedSet); return { sharedCriterion: { resourceName: s.rn, keyword: { text: s.text, matchType: s.match } }, sharedSet: { resourceName: set.rn, name: set.name } }; }); break;
      case "campaign_shared_set": rows = db.campaignSharedSets.map((s) => { const set = byRn(db.sharedSets, s.sharedSet); return { campaignSharedSet: { resourceName: s.rn, status: s.status }, campaign: campRow(camp(s.campaign)), sharedSet: { resourceName: set.rn, name: set.name } }; }); break;
      default: throw new Error(`mock: unhandled FROM ${from}`);
    }
    let i = 0;
    return { hasNext: () => i < rows.length, next: () => rows[i++] };
  }

  const P = !!opts.preview;
  const result = (rn, msgs) => ({ isSuccessful: () => !msgs, getResourceName: () => (msgs ? null : rn), getErrorMessages: () => msgs || [] });
  const ourGroup = (rn) => { const g = byRn(db.adGroups, rn); return g && g.name === GROUP && g.campaign === target()?.rn; };

  function plan(o, temp) {
    const type = Object.keys(o)[0], b = o[type];
    const real = (rn, what) => {
      if (typeof rn === "string" && /\/-\d+$/.test(rn)) { if (!temp[rn]) { err(`temp ID ${rn} used before being defined (${what})`); return null; } return temp[rn]; }
      return rn;
    };
    const newRn = (coll) => `customers/${C}/${coll}/${++db.seq}`;
    if (b.remove) { err(`remove op: ${JSON.stringify(b)}`); return { fail: "bad" }; }
    switch (type) {
      case "adGroupOperation": {
        if (b.update) {
          const g = byRn(db.adGroups, b.update.resourceName);
          if (!g || !ourGroup(g.rn)) { err(`ad group update outside "${GROUP}" ${b.update.resourceName}`); return { fail: "bad" }; }
          if (b.updateMask !== "final_url_suffix" || b.update.status || b.update.name) err(`ad group update beyond suffix: ${JSON.stringify(b)}`);
          if (b.update.finalUrlSuffix !== SUFFIX) err(`suffix ${b.update.finalUrlSuffix}`);
          return { rn: g.rn, apply: () => (g.suffix = b.update.finalUrlSuffix) };
        }
        const c = b.create;
        if (c.campaign !== target()?.rn) { err(`ad group created outside ${CAMPAIGN}: ${c.campaign}`); return { fail: "bad" }; }
        if (c.name !== GROUP) err(`ad group name "${c.name}" (must be "${GROUP}", no prefix)`);
        if (c.cpcBidMicros != null || c.cpcBid) err("ad group sets its own CPC (must inherit the campaign strategy)");
        if (c.finalUrlSuffix !== SUFFIX) err(`ad group suffix ${c.finalUrlSuffix}`);
        if (c.type !== "SEARCH_STANDARD") err(`ad group type ${c.type}`);
        if (!/\/-\d+$/.test(c.resourceName || "")) err("ad group create without temp resourceName");
        const rn = newRn("adGroups");
        temp[c.resourceName] = rn;
        return { rn, apply: () => db.adGroups.push({ rn, name: c.name, campaign: c.campaign, status: c.status, suffix: c.finalUrlSuffix }) };
      }
      case "adGroupCriterionOperation": {
        const c = b.create, ag = real(c.adGroup, "keyword");
        if (!ag) return { fail: "bad" };
        if (byRn(db.adGroups, ag) && !ourGroup(ag)) { err(`keyword outside "${GROUP}": ${ag}`); return { fail: "bad" }; }
        if (c.negative) err("negative keyword in ad group");
        if (!WANT_KW.includes(`${c.keyword.text}|${c.keyword.matchType}`)) err(`unplanned keyword ${c.keyword.text} [${c.keyword.matchType}]`);
        if (/altan|altán/i.test(c.keyword.text)) err(`Altán keyword created: ${c.keyword.text}`);
        const rn = newRn("adGroupCriteria");
        return { rn, apply: () => db.keywords.push({ rn, adGroup: ag, text: c.keyword.text, match: c.keyword.matchType, status: c.status }) };
      }
      case "adGroupAdOperation": {
        const c = b.create, ag = real(c.adGroup, "ad");
        if (!ag) return { fail: "bad" };
        if (byRn(db.adGroups, ag) && !ourGroup(ag)) { err(`ad outside "${GROUP}": ${ag}`); return { fail: "bad" }; }
        const rsa = c.ad.responsiveSearchAd;
        if (opts.rejectAd) return { fail: "POLICY_FINDING: mock rejection" };
        const rn = newRn("adGroupAds");
        return { rn, apply: () => db.ads.push({ rn, adGroup: ag, status: c.status, finalUrls: c.ad.finalUrls, headlines: rsa.headlines, descriptions: rsa.descriptions, path1: rsa.path1, path2: rsa.path2 }) };
      }
      case "sharedCriterionOperation": {
        const c = b.create, s = byRn(db.sharedSets, c.sharedSet);
        if (!s || s.name !== "Nova | Negatives") { err(`negative added to ${s?.name || c.sharedSet}`); return { fail: "bad" }; }
        if (c.keyword.matchType !== "PHRASE" || !NEW_NEGS.includes(c.keyword.text)) err(`unexpected negative ${c.keyword.text} [${c.keyword.matchType}]`);
        const rn = newRn("sharedCriteria");
        return { rn, apply: () => db.sharedCriteria.push({ rn, sharedSet: s.rn, text: c.keyword.text, match: c.keyword.matchType }) };
      }
    }
    err(`unexpected operation ${type} ${JSON.stringify(b).slice(0, 200)}`);
    return { fail: "unexpected" };
  }

  function mutateAll(ops, options) {
    calls.push({ ops, options });
    if (!options || typeof options.partialFailure !== "boolean") err("mutateAll without explicit partialFailure");
    const atomic = !options.partialFailure, temp = {};
    const planned = ops.map((o) => plan(o, temp));
    const anyFail = planned.some((p) => p.fail);
    if (!P && !(atomic && anyFail)) planned.forEach((p) => p.apply && p.apply());
    const failed = { isSuccessful: () => false, getResourceName: () => null, getErrorMessages: () => [] };
    return planned.map((p, i) => {
      if (p.fail) return result(null, [p.fail]);
      if (atomic && anyFail) return failed;
      const isCreate = !!ops[i][Object.keys(ops[i])[0]].create;
      return result(P && isCreate ? String(p.rn).replace(/\/(\d+)$/, "/90$1") : p.rn);
    });
  }
  const AdsApp = {
    currentAccount: () => ({ getCustomerId: () => "823-438-8697", getCurrencyCode: () => opts.currency || "MXN" }),
    getExecutionInfo: () => ({ isPreview: () => P }),
    search, mutateAll,
  };
  return { AdsApp, Logger: { log: (s) => logs.push(String(s)) }, logs, calls, queries };
}

function run(db, opts = {}) {
  const env = makeEnv(db, opts);
  let src = opts.src || SCRIPT;
  if (opts.dryRun) src = src.replace("var DRY_RUN = false;", "var DRY_RUN = true;");
  try {
    vm.runInContext(src + "\nmain();", vm.createContext({ AdsApp: env.AdsApp, Logger: env.Logger }), { filename: "novaphone-ads-registro.js", timeout: 20000 });
  } catch (e) { err(`[${opts.name}] JS error: ${e.stack || e}`); }
  if (opts.print) console.log(env.logs.join("\n"));
  return { ...env, ops: env.calls.flatMap((c) => c.ops) };
}

const snap = (db) => JSON.stringify({ ...db, seq: 0 });
const target = (db) => db.campaigns.find((c) => c.name === CAMPAIGN);
const theGroup = (db) => db.adGroups.find((g) => g.campaign === target(db)?.rn && g.name === GROUP && g.status !== "REMOVED");
// Everything except "Sin registro" (in the target campaign), its children and the Nova negatives must stay byte-identical.
const untouched = (db) => {
  const g = theGroup(db)?.rn;
  const nova = db.sharedSets.find((s) => s.name === "Nova | Negatives")?.rn;
  return JSON.stringify([db.campaigns, db.adGroups.filter((x) => x.rn !== g), db.keywords.filter((k) => k.adGroup !== g), db.ads.filter((a) => a.adGroup !== g),
    db.sharedSets, db.sharedCriteria.filter((s) => s.sharedSet !== nova || MAIN_NEGS.includes(s.text)), db.campaignSharedSets]);
};

function checkAd(a, tag) {
  if (a.finalUrls.length !== 1 || a.finalUrls[0] !== "https://novaphone.lat/") err(`${tag}: final URL ${a.finalUrls}`);
  if (a.path1 !== "esim" || a.path2 !== "mexico") err(`${tag}: path ${a.path1}/${a.path2}`);
  if (a.headlines.length < 3 || a.headlines.length > 15) err(`${tag}: ${a.headlines.length} headlines`);
  if (a.descriptions.length < 2 || a.descriptions.length > 4) err(`${tag}: ${a.descriptions.length} descriptions`);
  if (new Set(a.headlines.map((h) => norm(h.text))).size !== a.headlines.length) err(`${tag}: duplicate headlines`);
  for (const h of a.headlines) {
    if (clen(h.text) > 30) err(`${tag}: headline > 30 "${h.text}" (${clen(h.text)})`);
    if (BAD_COPY.test(h.text)) err(`${tag}: headline violates policy "${h.text}"`);
    if (h.pinnedField) err(`${tag}: headline pinned "${h.text}"`);
  }
  for (const d of a.descriptions) {
    if (clen(d.text) > 90) err(`${tag}: description > 90 "${d.text}" (${clen(d.text)})`);
    if (BAD_COPY.test(d.text)) err(`${tag}: description violates policy "${d.text}"`);
  }
  const pinned = a.descriptions.filter((d) => d.pinnedField);
  if (pinned.length !== 1 || pinned[0].pinnedField !== "DESCRIPTION_1" || a.descriptions[0] !== pinned[0]) err(`${tag}: pin ${JSON.stringify(pinned)}`);
  if (BAD_COPY.test(`${a.path1} ${a.path2}`)) err(`${tag}: path violates policy`);
}

function checkFinal(db, tag) {
  const g = theGroup(db);
  if (!g) return err(`${tag}: no "${GROUP}" group in ${CAMPAIGN}`);
  if (db.adGroups.filter((x) => x.campaign === target(db).rn && x.name === GROUP).length !== 1) err(`${tag}: duplicate "${GROUP}" groups`);
  if (g.suffix !== SUFFIX) err(`${tag}: suffix ${g.suffix}`);
  const kws = db.keywords.filter((k) => k.adGroup === g.rn && k.status !== "REMOVED").map((k) => `${k.text}|${k.match}`).sort();
  if (JSON.stringify(kws) !== JSON.stringify(WANT_KW)) err(`${tag}: keywords ${kws.join(", ")}`);
  const ads = db.ads.filter((a) => a.adGroup === g.rn && a.status !== "REMOVED");
  if (ads.length !== 1) err(`${tag}: ${ads.length} RSAs`);
  else if (ads[0].headlines) checkAd(ads[0], tag);
  const set = db.sharedSets.find((s) => s.name === "Nova | Negatives");
  const negs = db.sharedCriteria.filter((s) => s.sharedSet === set.rn);
  for (const n of NEW_NEGS) if (negs.filter((x) => x.text === n && x.match === "PHRASE").length !== 1) err(`${tag}: negative "${n}" x${negs.filter((x) => x.text === n).length}`);
  const novaKw = db.keywords.filter((k) => isNova(db.campaigns.find((c) => c.rn === db.adGroups.find((x) => x.rn === k.adGroup)?.campaign)?.name)).map((k) => norm(k.text));
  for (const n of negs) for (const t of novaKw) if (` ${t} `.includes(` ${norm(n.text)} `)) err(`${tag}: negative "${n.text}" blocks "${t}"`);
  if (db.sharedCriteria.some((s) => s.sharedSet !== set.rn && NEW_NEGS.includes(s.text))) err(`${tag}: negative added to a non-Nova list`);
}

console.log("validate-novaphone-ads-registro:");

// 1. Fresh run + idempotent re-run
{
  const db = newDb();
  const before = untouched(db);
  const r = run(db, { name: "fresh" });
  checkFinal(db, "fresh");
  if (untouched(db) !== before) err("fresh: something outside the new group / new negatives changed");
  if (r.logs.some((l) => /^\s*FAIL |ABORTADO:|ERRORES/.test(l))) err(`fresh: ${r.logs.filter((l) => /^\s*FAIL |ABORTADO:|ERRORES/.test(l)).join(" / ")}`);
  const kwOps = r.ops.filter((o) => o.adGroupCriterionOperation).length, negOps = r.ops.filter((o) => o.sharedCriterionOperation).length;
  if (kwOps !== 15 || negOps !== 3) err(`fresh: ${kwOps} keyword ops (15), ${negOps} negative ops (3; "telcel app" already there)`);
  if (!r.logs.some((l) => /"esim sin registro" \[EXACT\] ya existe en Nova \| Search \| eSIM México > eSIM sin contrato/.test(l))) err("fresh: duplicate-keyword warning missing");
  ok(`fresh: ${r.ops.length} ops in ${r.calls.length} batches (1 group, ${kwOps} keywords, 1 RSA, ${negOps} negatives); Faro "Sin registro", Nahui and other Nova groups untouched`);
  const r2 = run(db, { name: "rerun" });
  if (r2.calls.length) err(`rerun: expected no mutateAll, got ${r2.ops.length} ops`);
  if (!r2.logs.some((l) => /Nada que cambiar/.test(l))) err("rerun: missing 'Nada que cambiar'");
  ok("re-run: 0 operations, prints 'Nada que cambiar'");
}
// 2. Preview
{
  const db = newDb(), before = snap(db);
  const r = run(db, { name: "preview", preview: true });
  if (snap(db) !== before) err("preview: account changed");
  if (!r.logs.some((l) => /VISTA PREVIA: Google solo simuló/.test(l))) err("preview: missing notice");
  if (r.logs.some((l) => /^\s*FAIL |ABORTADO:/.test(l))) err("preview: FAIL/ABORTADO");
  if (r.ops.filter((o) => o.adGroupAdOperation).length !== 1) err("preview: RSA not simulated in the same batch as the group");
  ok(`preview: ${r.ops.length} simulated ops (group + keywords + RSA in one batch with a temp ID), account unchanged`);
}
// 3. DRY_RUN
{
  const db = newDb(), before = snap(db);
  const r = run(db, { name: "dry", dryRun: true });
  if (r.calls.length || snap(db) !== before || !r.logs.some((l) => /\(dry run\)/.test(l))) err("dry run: mutateAll called / plan not printed");
  ok("DRY_RUN: plan printed, no mutateAll");
}
// 4. Partial state: group exists PAUSED (director, POLICY §7), one keyword missing, old suffix, ad PAUSED
{
  const db = newDb();
  run(db, { name: "setup" });
  const g = theGroup(db);
  g.status = "PAUSED"; g.suffix = "utm_source=google";
  const k = db.keywords.find((x) => x.adGroup === g.rn && x.text === "chip sim sin registro");
  k.status = "REMOVED";
  const paused = db.keywords.find((x) => x.adGroup === g.rn && x.text === "sim virtual sin registro");
  paused.status = "PAUSED";
  db.ads.find((a) => a.adGroup === g.rn).status = "PAUSED";
  const r = run(db, { name: "partial" });
  const kinds = r.ops.map((o) => Object.keys(o)[0] + (o.adGroupOperation?.update ? ".update" : "")).sort().join(",");
  if (kinds !== "adGroupCriterionOperation,adGroupOperation.update") err(`partial: ops ${kinds}`);
  if (g.status !== "PAUSED" || paused.status !== "PAUSED" || db.ads.find((a) => a.adGroup === g.rn).status !== "PAUSED") err("partial: a paused entity was re-enabled");
  if (g.suffix !== SUFFIX) err("partial: suffix not fixed");
  if (!r.logs.some((l) => /está PAUSED; este script no lo reactiva/.test(l))) err("partial: no paused-group warning");
  if (run(db, { name: "partial-rerun" }).calls.length) err("partial: re-run not idempotent");
  ok("existing paused group: adds the missing keyword + fixes the suffix only; never re-enables group/keyword/ad; idempotent");
}
// 5. Copy guard: any bad edit aborts before reading/mutating
{
  const cases = [
    ["'Sin Registro de CURP' headline", (s) => s.replace("'Recarga Cuando Quieras',", "'Sin Registro de CURP',")],
    ["'Compra 100% en Línea' headline", (s) => s.replace("'Compra Todo en Línea',", "'Compra 100% en Línea',")],
    ["'Sin INE' headline", (s) => s.replace("'Recarga Cuando Quieras',", "'Sin INE ni Contrato',")],
    ["headline > 30", (s) => s.replace("'Recarga Cuando Quieras',", "'Recarga Tu eSIM Cuando Tú Quieras',")],
    ["director's original description 1 (103 chars)", (s) => s.replace("eSIM de solo datos, sin número ni contrato. Instálala con un QR y navega en red Telcel 5G.", "eSIM de solo datos: sin número telefónico, sin contrato. Instálala con un QR y navega en red Telcel 5G.")],
    ["description mentions registro", (s) => s.replace("Recarga desde tu panel cuando quieras.", "Sin registro de línea.")],
    ["path 'sin-registro'", (s) => s.replace("var PATH2 = 'mexico';", "var PATH2 = 'sin-registro';")],
    ["dynamic keyword insertion", (s) => s.replace("'Recarga Cuando Quieras',", "'{KeyWord:eSIM México}',")],
    ["foreign URL", (s) => s.replace("var FINAL_URL = SITE + '/';", "var FINAL_URL = 'https://faroesim.com/';")],
    ["'chip altan sin registro' keyword (blocked by 'altan')", (s) => s.replace("'chip sim sin registro',", "'chip sim sin registro', 'chip altan sin registro',")],
    ["pin removed", (s) => s.replace(", pin: 'DESCRIPTION_1' }", " }")],
    ["'Nova | ' prefix on the group", (s) => s.replace("var AD_GROUP = 'Sin registro';", "var AD_GROUP = 'Nova | Sin registro';")],
    ["'registro' as a negative", (s) => s.replace("'telcel app'];", "'telcel app', 'registro'];")],
  ];
  for (const [name, patch] of cases) {
    const db = newDb(), before = snap(db);
    const src = patch(SCRIPT);
    if (src === SCRIPT) { err(`copy guard "${name}": patch did not apply`); continue; }
    const r = run(db, { name, src });
    if (r.calls.length || snap(db) !== before || !r.logs.some((l) => /ABORTADO/.test(l))) err(`copy guard "${name}": did not abort`);
  }
  ok(`copy guard: ${cases.length} bad edits abort with 0 mutations (registro/CURP/INE/100%/{KeyWord}, >30, >90, path, URL, Altán keyword, pin, prefix, "registro" negative)`);
}
// 6. Prerequisites and live conflicts abort
{
  for (const [name, variant] of [["no campaign", { campaign: "none" }], ["no negative list", { negList: "none" }], ["live negative 'virtual' blocks a keyword", { extraNegs: ["virtual"] }]]) {
    const db = newDb(variant), before = snap(db);
    const r = run(db, { name, });
    if (r.calls.length || snap(db) !== before || !r.logs.some((l) => /ABORTADO/.test(l))) err(`prereq "${name}": did not abort`);
  }
  const db = newDb(), before = snap(db);
  const r = run(db, { name: "usd", currency: "USD" });
  if (r.calls.length || snap(db) !== before || !r.logs.some((l) => /ABORTADO/.test(l))) err("usd: should abort");
  ok("missing campaign / missing 'Nova | Negatives' / a live negative that would block a keyword / non-MXN: abort, 0 mutations");
}
// 7. Paused campaign: works, warns
{
  const db = newDb({ campaignStatus: "PAUSED" });
  const r = run(db, { name: "paused-campaign" });
  checkFinal(db, "paused-campaign");
  if (target(db).status !== "PAUSED") err("paused-campaign: campaign status changed");
  if (!r.logs.some((l) => /está PAUSED: el grupo no servirá/.test(l))) err("paused-campaign: no warning");
  ok("paused campaign: group created, campaign left PAUSED, warning printed");
}
// 8. RSA rejected by policy: group + keywords created, ad reported, re-run retries only the ad
{
  const db = newDb();
  const r = run(db, { name: "reject", rejectAd: true });
  const g = theGroup(db);
  if (!g || db.keywords.filter((k) => k.adGroup === g.rn).length !== 15) err("reject: group/keywords not created");
  if (g && db.ads.some((a) => a.adGroup === g.rn)) err("reject: rejected ad exists");
  if (!r.logs.some((l) => /reintento sin anuncio/.test(l)) || !r.logs.some((l) => /POLICY.md §7/.test(l))) err("reject: no retry / §7 warning");
  const r2 = run(db, { name: "reject-fixed" });
  if (r2.ops.length !== 1 || !r2.ops[0].adGroupAdOperation) err(`reject-fixed: expected only the RSA, got ${r2.ops.length} ops`);
  checkFinal(db, "reject-fixed");
  ok("rejected RSA: group + 15 keywords kept, §7 warning; next run creates only the RSA");
}

// ----------------------------------------------------------------------------- Policy check of every ad line
{
  const ctx = vm.createContext({});
  vm.runInContext(SCRIPT + "\nthis.__plan = { HEADLINES, DESCRIPTIONS, PATH1, PATH2, FINAL_URL };", ctx);
  const { HEADLINES, DESCRIPTIONS, PATH1, PATH2, FINAL_URL } = ctx.__plan;
  console.log("\n  Policy check (≤30 / ≤90 / ≤15, banned words, Title-case OK, no '!' / '{'):");
  const line = (kind, text, max) => {
    const n = clen(text), bad = BAD_COPY.test(text);
    if (n > max || bad) err(`policy line ${kind} "${text}" (${n}/${max}${bad ? ", banned word" : ""})`);
    console.log(`    ${n <= max && !bad ? "PASS" : "FAIL"}  ${kind.padEnd(5)} ${String(n).padStart(2)}/${max}  ${text}`);
  };
  HEADLINES.forEach((h, i) => line(`H${i + 1}`, h, 30));
  DESCRIPTIONS.forEach((d, i) => line(`D${i + 1}`, d.text, 90));
  line("P1", PATH1, 15);
  line("P2", PATH2, 15);
  console.log(`    URL   ${FINAL_URL} · D1 pinned to ${DESCRIPTIONS[0].pin}`);
}

done = true;

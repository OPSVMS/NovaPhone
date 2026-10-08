// Simulador del API de eSIM Access + tipo de cambio, para pruebas E2E aisladas.
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";

// ---------- NOVACORE (CLABEs + depósitos SPEI) ----------
const NC = { apiKey: "test-novacore-key", signing: "test-novacore-signing", callback: "test-novacore-callback", target: process.env.APP_URL ?? "http://web:3000" };
const clabes = new Map(); // externalUserId -> clabe
const speiDeposits = []; // { trackingKey, amount, beneficiaryAccount, externalUserId, status, settledAt }
let clabeSeq = 1;
function verifyNc(req, raw) {
  const ts = req.headers["x-signature-timestamp"], nonce = req.headers["x-signature-nonce"], sig = req.headers["x-signature"];
  if (req.headers["x-api-key"] !== NC.apiKey || !ts || !nonce || !sig) return false;
  return sig === "sha256=" + createHmac("sha256", NC.signing).update(`${ts}.${nonce}.${raw}`).digest("hex");
}
async function sendNcCallback(dep, opts = {}) {
  const body = JSON.stringify({ type: "deposit.received", currency: "MXN", payerAccount: "012180001234567890", payerName: "CLIENTE PRUEBA", concept: "Pago", receivedAt: new Date().toISOString(), ...dep });
  const ts = String(Math.floor(Date.now() / 1000) - (opts.oldTs ? 900 : 0));
  const nonce = opts.nonce ?? randomUUID();
  const sig = opts.badSig ? "00" : createHmac("sha256", NC.callback).update(`${ts}.${nonce}.${body}`).digest("hex");
  const r = await fetch(`${NC.target}/api/webhooks/novacore`, { method: "POST", headers: { "content-type": "application/json", "x-novacore-timestamp": ts, "x-novacore-nonce": nonce, "x-novacore-signature": sig }, body });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

// ---------- cloudnumbering API v1.1 ----------
const cnEndpoints = [];
const cnNumbers = [];
let cnSeq = 100;
function cnHandle(req, url, raw) {
  const p = url.pathname.replace("/cn/v1.1", "");
  const auth = req.headers.authorization;
  if (p === "/oauth/token") {
    if (url.searchParams.get("client_id") !== "test-cn-id" || url.searchParams.get("client_secret") !== "test-cn-secret") return [401, { success: false }];
    return [200, { access_token: "cn-token", accessToken: "cn-token", expires_in: 7200 }];
  }
  if (auth !== "Bearer cn-token") return [401, { success: false, error: "unauthorized" }];
  const body = raw ? JSON.parse(raw) : {};
  if (p === "/organisation") return [200, { success: true, result: { balance: 300, currency: "GBP" } }];
  if (p === "/endpoints" && req.method === "GET") return [200, { success: true, result: { entries: cnEndpoints } }];
  if (p === "/endpoints" && req.method === "POST") { const e = { sid: `EP${cnSeq++}`, ...body }; cnEndpoints.push(e); return [200, { success: true, result: { sid: e.sid } }]; }
  if (p === "/number-groups") return [200, { success: true, result: { entries: [{ sid: "NGGB", countryIso: "GB", numberType: "LOCAL" }] } }];
  if (p === "/catalogue") return [200, { success: true, result: { entries: [{ sid: "REGB1", countryIso: "GB", numberType: "LOCAL", terms: "MONTHLY", cost: 0.99, connectionCharge: 1, currency: "GBP" }] } }];
  if (p === "/orders/preview") return [200, { success: true, result: { totalCost: 1.99 * body.amount, currency: "GBP", quoteToken: "q-123" } }];
  if (p === "/orders" && req.method === "POST") {
    if (body.quoteToken !== "q-123" || !req.headers["idempotency-key"]) return [400, { success: false, error: "bad order" }];
    const numbers = Array.from({ length: body.amount }, () => { const n = { sid: `AN${cnSeq++}`, number: `+447428${String(500000 + cnSeq).padStart(6, "0")}`, countryIso: "GB", smsEndpointSid: "" }; cnNumbers.push(n); return { sid: n.sid, number: n.number }; });
    return [200, { success: true, result: { sid: `NO${cnSeq++}`, numbers } }];
  }
  const m = p.match(/^\/numbers\/([^/]+)\/endpoints$/);
  if (m) { const n = cnNumbers.find((x) => x.sid === m[1]); if (!n) return [200, { success: false, error: "not found" }]; n.smsEndpointSid = body.smsEndpointSid; return [200, { success: true, result: {} }]; }
  if (p === "/numbers") return [200, { success: true, result: { entries: cnNumbers }, meta: { pagination: { page: 1, pageCount: 1 } } }];
  return [404, { success: false, error: "Route not found" }];
}

// ---------- Openpay (cargos con redirección) ----------
const charges = new Map();

const pkg = (slug, gb, days, priceUsd) => ({
  packageCode: `P_${slug}`, slug, name: `Mexico ${gb}GB ${days}Days`, price: Math.round(priceUsd * 10_000),
  volume: gb * 1024 ** 3, duration: days, durationUnit: "DAY", location: "MX", dataType: 1, speed: "3G/4G/5G",
  locationNetworkList: [{ locationName: "Mexico", operatorList: [{ operatorName: "Telcel", networkType: "5G" }, { operatorName: "AT&T", networkType: "5G" }] }],
});
const PACKAGES = [pkg("MX_1_7", 1, 7, 1.55), pkg("MX_5_30", 5, 30, 7.49), pkg("MX_20_30", 20, 30, 24.68), pkg("MX_2_7", 2, 7, 3.0)];
const FAILING = "P_MX_2_7"; // este plan siempre falla al ordenar → prueba de reembolso
let balance = 100 * 10_000;
const orders = new Map(); // orderNo -> { queries, pkg }
const esims = new Map(); // esimTranNo -> { orderNo, n, volume, used, duration, activated, expires }
let seq = 1;

function esimView(tran) {
  const e = esims.get(tran);
  return {
    esimTranNo: tran, orderNo: e.orderNo, iccid: `89650126000000${e.n}`, ac: `LPA:1$rsp-test.simlessly.com$TESTCODE${e.n}`,
    qrCodeUrl: "", shortUrl: "", apn: "e-ideas", esimStatus: e.cancelled ? "CANCEL" : e.suspended ? "SUSPENDED" : e.activated ? "IN_USE" : "GOT_RESOURCE", smdpStatus: e.activated ? "ENABLED" : "RELEASED",
    totalVolume: e.volume, orderUsage: e.used, totalDuration: e.duration,
    activateTime: e.activated ? new Date(e.activated).toISOString() : null, expiredTime: new Date(e.expires).toISOString(),
  };
}

const ok = (obj) => ({ success: true, errorCode: "0", errorMsg: null, obj });
const fail = (code, msg) => ({ success: false, errorCode: code, errorMsg: msg, obj: null });

const routes = {
  "/api/v1/open/balance/query": () => ok({ balance }),
  "/api/v1/open/package/list": (b) => {
    if (b.type === "TOPUP") {
      if (!esims.has(b.esimTranNo)) return fail("310403", "The ICCID does not exist in the order.");
      return ok({ packageList: PACKAGES.filter((p) => p.packageCode !== FAILING).map((p) => ({ ...p, packageCode: `TOPUP_${p.slug}` })) });
    }
    return ok({ packageList: PACKAGES.filter((p) => !b.locationCode || p.location === b.locationCode) });
  },
  "/api/v1/open/esim/order": (b) => {
    const code = b.packageInfoList?.[0]?.packageCode;
    const p = PACKAGES.find((x) => x.packageCode === code || x.slug === code);
    if (!p) return fail("310241", "The packageCode does not exist.");
    if (code === FAILING) return fail("200011", "Insufficient available Profiles for the package");
    balance -= p.price;
    const orderNo = `B${Date.now()}${seq++}`;
    orders.set(orderNo, { queries: 0, pkg: p, tx: b.transactionId });
    return ok({ orderNo, transactionId: b.transactionId });
  },
  "/api/v1/open/esim/query": (b) => {
    if (b.esimTranNo) return esims.has(b.esimTranNo) ? ok({ esimList: [esimView(b.esimTranNo)] }) : fail("310403", "not found");
    const o = orders.get(b.orderNo);
    if (!o) return fail("310272", "The orderNo does not exist.");
    o.queries++;
    if (o.queries < 2) return fail("200010", "Profile is being downloaded for the order.");
    const tran = `T${b.orderNo}`;
    if (!esims.has(tran)) esims.set(tran, { orderNo: b.orderNo, n: String(seq++).padStart(6, "0"), volume: o.pkg.volume, used: 0, duration: o.pkg.duration, activated: null, expires: Date.now() + 180 * 86400000 });
    return ok({ esimList: [esimView(tran)] });
  },
  "/api/v1/open/esim/cancel": (b) => {
    const e = esims.get(b.esimTranNo);
    if (!e) return fail("310403", "not found");
    if (e.activated) return fail("200002", "This operation is not allowed due to the order status.");
    e.cancelled = true;
    return ok({});
  },
  "/api/v1/open/esim/suspend": (b) => (esims.has(b.esimTranNo) ? ((esims.get(b.esimTranNo).suspended = true), ok({})) : fail("310403", "not found")),
  "/api/v1/open/esim/unsuspend": (b) => (esims.has(b.esimTranNo) ? ((esims.get(b.esimTranNo).suspended = false), ok({})) : fail("310403", "not found")),
  "/api/v1/open/esim/topup": (b) => {
    const e = esims.get(b.esimTranNo);
    if (!e) return fail("310403", "The ICCID does not exist in the order.");
    const p = PACKAGES.find((x) => `TOPUP_${x.slug}` === b.packageCode);
    if (!p) return fail("310241", "The packageCode does not exist.");
    balance -= p.price;
    e.volume += p.volume;
    e.duration += p.duration;
    if (e.activated) e.expires += p.duration * 86400000;
    return ok({ transactionId: b.transactionId, iccid: `89650126000000${e.n}`, expiredTime: new Date(e.expires).toISOString(), totalVolume: e.volume, totalDuration: e.duration, orderUsage: e.used, topUpEsimTranNo: `U${Date.now()}` });
  },
  "/api/v1/open/webhook/save": () => ok({}),
};

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    const url = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/fx") return res.end(JSON.stringify({ rates: { MXN: 18 } }));
    if (url.pathname === "/health") return res.end("{}");
    if (url.pathname.startsWith("/cn/v1.1/")) {
      const [code, json] = cnHandle(req, url, raw);
      res.statusCode = code;
      return res.end(JSON.stringify(json));
    }
    if (url.pathname === "/__test/cn/numbers") return res.end(JSON.stringify({ numbers: cnNumbers, endpoints: cnEndpoints }));
    // NOVACORE API
    if (url.pathname === "/api/integrations/clabes" && req.method === "POST") {
      if (!verifyNc(req, raw)) { res.statusCode = 401; return res.end(JSON.stringify({ error: "invalid signature" })); }
      const b = JSON.parse(raw);
      const isNew = !clabes.has(b.externalUserId);
      if (isNew) clabes.set(b.externalUserId, `6841803270${String(clabeSeq++).padStart(8, "0")}`);
      res.statusCode = isNew ? 201 : 200;
      return res.end(JSON.stringify({ clabe: clabes.get(b.externalUserId), externalUserId: b.externalUserId, isNew, bank: "TRANSFER", beneficiaryName: "MACAIBA COMMERCE" }));
    }
    if (url.pathname === "/api/integrations/spei-deposits" && req.method === "GET") {
      if (!verifyNc(req, "")) { res.statusCode = 401; return res.end(JSON.stringify({ error: "invalid signature" })); }
      return res.end(JSON.stringify({ data: speiDeposits, nextCursor: null }));
    }
    // Test: simula un SPEI a una CLABE. send=false → no manda aviso (para probar conciliación).
    if (url.pathname === "/__test/novacore/deposit") {
      const b = JSON.parse(raw || "{}");
      const externalUserId = [...clabes.entries()].find(([, c]) => c === b.clabe)?.[0];
      const dep = { trackingKey: b.trackingKey ?? `MBAN${Date.now()}${Math.floor(Math.random() * 1e6)}`, amount: b.amount, beneficiaryAccount: b.clabe, externalUserId, status: "completed", settledAt: new Date().toISOString() };
      speiDeposits.push(dep);
      const callback = b.send === false ? null : await sendNcCallback({ trackingKey: dep.trackingKey, amount: dep.amount, beneficiaryAccount: dep.beneficiaryAccount, externalUserId }, b);
      return res.end(JSON.stringify({ ok: true, deposit: dep, callback }));
    }
    if (url.pathname === "/__test/novacore/replay") {
      const b = JSON.parse(raw || "{}");
      return res.end(JSON.stringify(await sendNcCallback(b.deposit, b)));
    }
    if (url.pathname === "/__test/novacore/return") {
      const b = JSON.parse(raw || "{}");
      const d = speiDeposits.find((x) => x.trackingKey === b.trackingKey);
      if (d) d.status = "returned";
      return res.end(JSON.stringify({ ok: !!d }));
    }
    // Openpay API
    const opMatch = url.pathname.match(/^\/v1\/([^/]+)\/charges(?:\/([^/]+))?$/);
    if (opMatch) {
      const auth = Buffer.from((req.headers.authorization ?? "").replace("Basic ", ""), "base64").toString();
      if (opMatch[1] !== "mtestmerchant" || auth !== "sk_test_openpay:") { res.statusCode = 401; return res.end(JSON.stringify({ description: "unauthorized" })); }
      if (req.method === "POST" && !opMatch[2]) {
        const b = JSON.parse(raw);
        const id = `tr${randomUUID().slice(0, 12)}`;
        const ch = { id, status: "charge_pending", amount: b.amount, order_id: b.order_id, redirect_url: b.redirect_url, payment_method: { type: "redirect", url: `${process.env.MOCK_PUBLIC_URL ?? "http://mock:4010"}/openpay/pay/${id}` } };
        charges.set(id, ch);
        return res.end(JSON.stringify(ch));
      }
      const ch = charges.get(opMatch[2]);
      if (!ch) { res.statusCode = 404; return res.end(JSON.stringify({ description: "not found" })); }
      return res.end(JSON.stringify(ch));
    }
    const payMatch = url.pathname.match(/^\/openpay\/pay\/([^/]+)(\/confirm)?$/);
    if (payMatch) {
      const ch = charges.get(payMatch[1]);
      if (!ch) { res.statusCode = 404; return res.end("not found"); }
      if (payMatch[2]) {
        ch.status = url.searchParams.get("result") === "fail" ? "failed" : "completed";
        if (ch.status === "failed") ch.error_message = "Tarjeta declinada";
        res.statusCode = 302;
        res.setHeader("location", `${ch.redirect_url}&id=${ch.id}`);
        return res.end();
      }
      res.setHeader("content-type", "text/html");
      return res.end(`<html><body><h1>Openpay Sandbox</h1><p>Monto: $${ch.amount} MXN</p><a id="pagar" href="/openpay/pay/${ch.id}/confirm?result=ok">Pagar</a> <a id="rechazar" href="/openpay/pay/${ch.id}/confirm?result=fail">Rechazar</a></body></html>`);
    }
    if (url.pathname === "/__test/usage") {
      const b = JSON.parse(raw || "{}");
      const e = esims.get(b.esimTranNo);
      if (!e) return res.end(JSON.stringify({ ok: false }));
      if (!e.activated) { e.activated = Date.now(); e.expires = Date.now() + e.duration * 86400000; }
      e.used = b.usedBytes;
      return res.end(JSON.stringify({ ok: true }));
    }
    if (req.headers["rt-accesscode"] !== "test-access-code") return res.end(JSON.stringify(fail("000101", "Request header (mandatory) is null")));
    const handler = routes[url.pathname];
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {}
    res.end(JSON.stringify(handler ? handler(body) : fail("000103", "not supported")));
  });
}).listen(4010, () => console.log("mock eSIM Access on :4010"));

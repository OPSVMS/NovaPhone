// Simuladores para pruebas E2E aisladas: eSIM Access + tipo de cambio, NOVACORE, cloudnumbering, Telnyx, Openpay y Stripe (/stripe/v1).
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
// Saldo de la cuenta (GBP). En 0 la cuenta no puede comprar números (POST /orders falla) → prueba "sin inventario".
let cnBalance = 300;
function cnHandle(req, url, raw) {
  const p = url.pathname.replace("/cn/v1.1", "");
  const auth = req.headers.authorization;
  if (p === "/oauth/token") {
    if (url.searchParams.get("client_id") !== "test-cn-id" || url.searchParams.get("client_secret") !== "test-cn-secret") return [401, { success: false }];
    return [200, { access_token: "cn-token", accessToken: "cn-token", expires_in: 7200 }];
  }
  if (auth !== "Bearer cn-token") return [401, { success: false, error: "unauthorized" }];
  const body = raw ? JSON.parse(raw) : {};
  if (p === "/organisation") return [200, { success: true, result: { balance: cnBalance, currency: "GBP" } }];
  if (p === "/endpoints" && req.method === "GET") return [200, { success: true, result: { entries: cnEndpoints } }];
  if (p === "/endpoints" && req.method === "POST") { const e = { sid: `EP${cnSeq++}`, ...body }; cnEndpoints.push(e); return [200, { success: true, result: { sid: e.sid } }]; }
  if (p === "/number-groups") return [200, { success: true, result: { entries: [{ sid: "NGGB", countryIso: "GB", numberType: "LOCAL" }] } }];
  if (p === "/catalogue") return [200, { success: true, result: { entries: [{ sid: "REGB1", countryIso: "GB", numberType: "LOCAL", terms: "MONTHLY", cost: 0.99, connectionCharge: 1, currency: "GBP" }] } }];
  if (p === "/orders/preview") return [200, { success: true, result: { totalCost: 1.99 * body.amount, currency: "GBP", quoteToken: "q-123" } }];
  if (p === "/orders" && req.method === "POST") {
    if (body.quoteToken !== "q-123" || !req.headers["idempotency-key"]) return [400, { success: false, error: "bad order" }];
    if (cnBalance <= 0) return [402, { success: false, error: "insufficient balance" }];
    const numbers = Array.from({ length: body.amount }, () => { const n = { sid: `AN${cnSeq++}`, number: `+447428${String(500000 + cnSeq).padStart(6, "0")}`, countryIso: "GB", smsEndpointSid: "" }; cnNumbers.push(n); return { sid: n.sid, number: n.number }; });
    return [200, { success: true, result: { sid: `NO${cnSeq++}`, numbers } }];
  }
  const m = p.match(/^\/numbers\/([^/]+)\/endpoints$/);
  if (m) { const n = cnNumbers.find((x) => x.sid === m[1]); if (!n) return [200, { success: false, error: "not found" }]; n.smsEndpointSid = body.smsEndpointSid; return [200, { success: true, result: {} }]; }
  if (p === "/numbers") return [200, { success: true, result: { entries: cnNumbers }, meta: { pagination: { page: 1, pageCount: 1 } } }];
  return [404, { success: false, error: "Route not found" }];
}

// ---------- Telnyx Voice API ----------
const telnyxCommands = [];

// ---------- Openpay (cargos con redirección) ----------
const charges = new Map();


// ---------- Stripe (API REST /stripe/v1 + página de pago alojada + webhooks firmados) ----------
const STRIPE = { key: "sk_test_mock", whsec: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_mock", target: process.env.APP_URL ?? "http://web:3000", pub: process.env.MOCK_PUBLIC_URL ?? "http://mock:4010" };
const sessions = new Map(); // cs_ -> session
const intents = new Map(); // pi_ -> payment intent
const refunds = [];
const sentEvents = []; // eventos enviados a la app con su respuesta
const promoCodes = new Map();
const sid = (p) => `${p}_test_${randomUUID().replace(/-/g, "").slice(0, 18)}`;

/** a[b][0][c]=v → objeto anidado (formato de Stripe). */
function parseForm(raw) {
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) {
    const path = k.replace(/\]/g, "").split("[");
    let o = out;
    path.forEach((seg, i) => {
      const last = i === path.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(path[i + 1]);
      if (last) o[seg] = v;
      else o = o[seg] ??= nextIsIndex ? [] : {};
    });
  }
  return out;
}

const signStripe = (payload, secret = STRIPE.whsec, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

async function sendStripeEvent(type, object, opts = {}) {
  const event = { id: opts.eventId ?? sid("evt"), object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } };
  const body = JSON.stringify(event);
  const sig = opts.badSig ? signStripe(body, "whsec_wrong") : signStripe(body, STRIPE.whsec, opts.oldTs ? Math.floor(Date.now() / 1000) - 3600 : undefined);
  const r = await fetch(`${STRIPE.target}/api/webhooks/stripe`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": sig }, body });
  const result = { eventId: event.id, type, status: r.status, json: await r.json().catch(() => ({})) };
  sentEvents.push(result);
  return result;
}

function sessionView(s, expand = []) {
  const v = { ...s };
  if (s.payment_intent && expand.some((e) => e.startsWith("payment_intent"))) v.payment_intent = intents.get(s.payment_intent) ?? s.payment_intent;
  return v;
}

/** Simula el pago: sesión completa, PaymentIntent y webhook firmado a la app (opts.webhook=false lo omite). */
async function payStripeSession(s, opts = {}) {
  if (s.status !== "open") return { already: s.status };
  if (opts.promo && s.allow_promotion_codes === "true") {
    const pc = { id: sid("promo"), object: "promotion_code", code: opts.promo, percent_off: 10 };
    promoCodes.set(pc.id, pc);
    const discount = Math.round(s.amount_total * 0.1);
    s.amount_total -= discount;
    s.total_details = { amount_discount: discount, amount_shipping: 0, amount_tax: 0 };
    s.discounts = [{ coupon: "launch", promotion_code: pc.id }];
  }
  const pi = { id: sid("pi"), object: "payment_intent", amount: s.amount_total, currency: s.currency, status: "succeeded", metadata: s.metadata, latest_charge: { id: sid("ch"), receipt_url: `${STRIPE.pub}/stripe/receipt/${s.id}` } };
  intents.set(pi.id, pi);
  s.status = "complete";
  s.payment_status = "paid";
  s.payment_intent = pi.id;
  // Como Stripe Checkout: sin customer_email la página pide el correo (opts.email); siempre existe una vez pagada.
  s.customer_details = { email: s.customer_email ?? opts.email ?? `buyer+${s.id.slice(-8)}@novaphone.test`, name: opts.name ?? null };
  const events = [];
  if (opts.webhook !== false) events.push(await sendStripeEvent("checkout.session.completed", { ...s }, { eventId: opts.eventId }));
  return { session: s, events };
}

async function stripeHandle(req, res, url, raw) {
  const send = (code, obj, type = "application/json") => { res.statusCode = code; res.setHeader("content-type", type); res.end(type === "application/json" ? JSON.stringify(obj) : obj); };
  const p = url.pathname;
  const body = raw ? (raw.trim().startsWith("{") ? JSON.parse(raw) : parseForm(raw)) : {};

  // ── Página de pago alojada ──
  const pay = p.match(/^\/stripe\/pay\/([^/]+)(\/confirm)?$/);
  if (pay) {
    const s = sessions.get(pay[1]);
    if (!s) return send(404, "not found", "text/plain");
    if (pay[2]) {
      if (url.searchParams.get("result") === "cancel") { res.statusCode = 302; res.setHeader("location", s.cancel_url); return res.end(); }
      await payStripeSession(s, { email: url.searchParams.get("email") || undefined });
      res.statusCode = 302;
      res.setHeader("location", s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id));
      return res.end();
    }
    const items = s.line_items.map((l) => `<li>${l.price_data.product_data.name} — $${(Number(l.price_data.unit_amount) / 100).toFixed(2)}</li>`).join("");
    return send(200, `<!doctype html><html lang="es"><body><h1>Stripe Checkout (test)</h1><p id="email">${s.customer_email ?? ""}</p><ul>${items}</ul><p id="total">Total: $${(s.amount_total / 100).toFixed(2)} ${String(s.currency).toUpperCase()}</p>${s.customer_email ? `<a id="pay" href="/stripe/pay/${s.id}/confirm?result=ok">Pagar</a>` : `<form id="pay-form" method="get" action="/stripe/pay/${s.id}/confirm"><input type="hidden" name="result" value="ok"><label>Correo <input id="checkout-email" name="email" type="email"></label> <button id="pay" type="submit">Pagar</button></form>`} <a id="cancel" href="/stripe/pay/${s.id}/confirm?result=cancel">Cancelar</a></body></html>`, "text/html");
  }
  if (p.startsWith("/stripe/receipt/")) return send(200, "<html><body>Recibo</body></html>", "text/html");

  // ── Ayudantes de prueba ──
  if (p === "/__test/stripe/sessions") return send(200, [...sessions.values()]);
  if (p === "/__test/stripe/events") return send(200, sentEvents);
  if (p === "/__test/stripe/refunds") return send(200, refunds);
  const find = () => sessions.get(body.sessionId) ?? [...sessions.values()].find((x) => x.client_reference_id === body.referenceId);
  if (p === "/__test/stripe/pay") {
    const s = find();
    if (!s) return send(404, { error: "no session" });
    return send(200, await payStripeSession(s, { webhook: body.webhook, promo: body.promo, email: body.email, name: body.name, eventId: body.eventId }));
  }
  if (p === "/__test/stripe/expire") {
    const s = find();
    if (!s) return send(404, { error: "no session" });
    s.status = "expired";
    return send(200, await sendStripeEvent("checkout.session.expired", { ...s }, { eventId: body.eventId }));
  }
  if (p === "/__test/stripe/refund-event" || p === "/__test/stripe/dispute") {
    const pi = intents.get(body.paymentIntentId);
    if (!pi) return send(404, { error: "no payment intent" });
    if (p.endsWith("dispute")) return send(200, await sendStripeEvent("charge.dispute.created", { id: sid("dp"), object: "dispute", payment_intent: pi.id, amount: pi.amount, reason: body.reason ?? "fraudulent" }));
    const amount = Number(body.amount ?? pi.amount);
    return send(200, await sendStripeEvent("charge.refunded", { id: pi.latest_charge.id, object: "charge", payment_intent: pi.id, amount: pi.amount, amount_refunded: amount, refunded: amount >= pi.amount }));
  }
  if (p === "/__test/stripe/webhook") return send(200, await sendStripeEvent(body.type, body.object ?? {}, body));

  // ── API REST ──
  if (req.headers.authorization !== `Bearer ${STRIPE.key}`) return send(401, { error: { message: "Invalid API Key provided", type: "invalid_request_error" } });
  const api = p.replace(/^\/stripe/, "");
  const expand = [...url.searchParams.entries()].filter(([k]) => k.startsWith("expand")).map(([, v]) => v);
  if (api === "/v1/checkout/sessions" && req.method === "POST") {
    const lines = body.line_items ?? [];
    if (!lines.length || !body.success_url || !body.cancel_url || !body.mode) return send(400, { error: { message: "Missing required param" } });
    if (lines.some((l) => l.price_data?.currency !== "mxn")) return send(400, { error: { message: "Solo MXN en pruebas" } });
    // Idempotencia como Stripe: misma llave → misma sesión.
    const key = req.headers["idempotency-key"];
    const prev = key && [...sessions.values()].find((x) => x._idem === key);
    if (prev) return send(200, prev);
    const id = sid("cs");
    const s = {
      id, object: "checkout.session", mode: body.mode, status: "open", payment_status: "unpaid", url: `${STRIPE.pub}/stripe/pay/${id}`, _idem: key,
      client_reference_id: body.client_reference_id ?? null, customer_email: body.customer_email ?? null, customer: null, customer_creation: body.customer_creation ?? null, locale: body.locale ?? null,
      success_url: body.success_url, cancel_url: body.cancel_url, metadata: body.metadata ?? {}, expires_at: Number(body.expires_at ?? 0),
      line_items: lines, amount_total: lines.reduce((a, l) => a + Number(l.price_data?.unit_amount ?? 0) * Number(l.quantity ?? 1), 0), currency: lines[0]?.price_data?.currency ?? "mxn",
      payment_intent: null, allow_promotion_codes: body.allow_promotion_codes ?? null, total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 }, discounts: [],
    };
    sessions.set(id, s);
    return send(200, s);
  }
  let m = api.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
  if (m) return sessions.has(m[1]) ? send(200, sessionView(sessions.get(m[1]), expand)) : send(404, { error: { message: "No such checkout.session" } });
  if (api === "/v1/refunds" && req.method === "POST") {
    if (!intents.has(body.payment_intent)) return send(404, { error: { message: "No such payment_intent" } });
    const r = { id: sid("re"), object: "refund", payment_intent: body.payment_intent, amount: Number(body.amount ?? intents.get(body.payment_intent).amount), metadata: body.metadata ?? {} };
    refunds.push(r);
    return send(200, r);
  }
  m = api.match(/^\/v1\/promotion_codes\/([^/]+)$/);
  if (m) return promoCodes.has(m[1]) ? send(200, promoCodes.get(m[1])) : send(404, { error: { message: "No such promotion_code" } });
  return send(404, { error: { message: `Unrecognized request URL (${req.method}: ${api})` } });
}

const pkg = (slug, gb, days, priceUsd) => ({
  packageCode: `P_${slug}`, slug, name: `Mexico ${gb}GB ${days}Days`, price: Math.round(priceUsd * 10_000),
  volume: gb * 1024 ** 3, duration: days, durationUnit: "DAY", location: "MX", dataType: 1, speed: "3G/4G/5G",
  locationNetworkList: [{ locationName: "Mexico", operatorList: [{ operatorName: "Telcel", networkType: "5G" }, { operatorName: "AT&T", networkType: "5G" }] }],
});
// MX_3_15: costo que daría $129 calculado; su precio de lista fijo es $109. MX_50_30: plan retirado de la venta (el proveedor lo sigue ofreciendo; NovaPhone no debe venderlo).
const PACKAGES = [pkg("MX_1_7", 1, 7, 1.55), pkg("MX_5_30", 5, 30, 7.49), pkg("MX_20_30", 20, 30, 24.68), pkg("MX_2_7", 2, 7, 3.0), pkg("MX_3_15", 3, 15, 5.0), pkg("MX_50_30", 50, 30, 75.0)];
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
    const tx = url.pathname.match(/^\/telnyx\/v2\/calls\/([^/]+)\/actions\/([^/]+)$/);
    if (tx) {
      if (req.headers.authorization !== "Bearer test-telnyx-key") { res.statusCode = 401; return res.end(JSON.stringify({ errors: [{ detail: "unauthorized" }] })); }
      telnyxCommands.push({ ccid: decodeURIComponent(tx[1]), action: tx[2], body: raw ? JSON.parse(raw) : {} });
      return res.end(JSON.stringify({ data: { result: "ok" } }));
    }
    if (url.pathname === "/__test/telnyx/commands") return res.end(JSON.stringify(telnyxCommands));
    // Stripe API + checkout alojado + webhooks firmados
    if (url.pathname.startsWith("/stripe/") || url.pathname.startsWith("/__test/stripe/")) return stripeHandle(req, res, url, raw);
    if (url.pathname === "/__test/cn/numbers") return res.end(JSON.stringify({ numbers: cnNumbers, endpoints: cnEndpoints }));
    if (url.pathname === "/__test/cn/state") {
      const b = JSON.parse(raw || "{}");
      if (typeof b.balance === "number") cnBalance = b.balance;
      return res.end(JSON.stringify({ balance: cnBalance }));
    }
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
      // Igual que producción: incluye depósitos de otras CLABEs de la empresa y estado "scattered".
      const foreign = { trackingKey: "FOREIGN123", amount: "18000.00", beneficiaryAccount: "684180327010000064", status: "scattered", settledAt: null };
      return res.end(JSON.stringify({ deposits: [foreign, ...speiDeposits.map((d) => ({ ...d, amount: Number(d.amount).toFixed(2), status: d.status === "completed" ? "scattered" : d.status }))], nextCursor: null }));
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
}).listen(4010, () => console.log("mock eSIM Access + Stripe + NOVACORE + cloudnumbering + Telnyx on :4010"));

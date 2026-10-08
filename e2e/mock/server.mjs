// Simulador del API de eSIM Access + tipo de cambio, para pruebas E2E aisladas.
import http from "node:http";

const pkg = (slug, gb, days, priceUsd) => ({
  packageCode: `P_${slug}`, slug, name: `Mexico ${gb}GB ${days}Days`, price: Math.round(priceUsd * 10_000),
  volume: gb * 1024 ** 3, duration: days, durationUnit: "DAY", location: "MX", dataType: 1, speed: "3G/4G/5G",
  locationNetworkList: [{ locationName: "Mexico", operatorList: [{ operatorName: "Telcel", networkType: "5G" }, { operatorName: "AT&T", networkType: "5G" }] }],
});
const PACKAGES = [pkg("MX_1_7", 1, 7, 1.55), pkg("MX_5_30", 5, 30, 7.49), pkg("MX_20_30", 20, 30, 24.68), pkg("MX_2_7", 2, 7, 3.0)];
const FAILING = "P_MX_2_7"; // este plan siempre falla al ordenar → prueba de reembolso
let balance = 100 * 10_000;
const orders = new Map(); // orderNo -> { queries, pkg }
let seq = 1;

const ok = (obj) => ({ success: true, errorCode: "0", errorMsg: null, obj });
const fail = (code, msg) => ({ success: false, errorCode: code, errorMsg: msg, obj: null });

const routes = {
  "/api/v1/open/balance/query": () => ok({ balance }),
  "/api/v1/open/package/list": (b) => ok({ packageList: PACKAGES.filter((p) => !b.locationCode || p.location === b.locationCode) }),
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
    const o = orders.get(b.orderNo);
    if (!o) return fail("310272", "The orderNo does not exist.");
    o.queries++;
    if (o.queries < 2) return fail("200010", "Profile is being downloaded for the order.");
    const n = String(seq).padStart(6, "0");
    return ok({ esimList: [{
      esimTranNo: `T${b.orderNo}`, orderNo: b.orderNo, iccid: `89650126000000${n}`, ac: `LPA:1$rsp-test.simlessly.com$TESTCODE${n}`,
      qrCodeUrl: "", shortUrl: "", apn: "e-ideas", esimStatus: "GOT_RESOURCE", smdpStatus: "RELEASED",
      totalVolume: o.pkg.volume, orderUsage: 0, expiredTime: new Date(Date.now() + 180 * 86400000).toISOString(),
    }] });
  },
  "/api/v1/open/esim/cancel": () => ok({}),
  "/api/v1/open/webhook/save": () => ok({}),
};

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/fx") return res.end(JSON.stringify({ rates: { MXN: 18 } }));
    if (url.pathname === "/health") return res.end("{}");
    if (req.headers["rt-accesscode"] !== "test-access-code") return res.end(JSON.stringify(fail("000101", "Request header (mandatory) is null")));
    const handler = routes[url.pathname];
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {}
    res.end(JSON.stringify(handler ? handler(body) : fail("000103", "not supported")));
  });
}).listen(4010, () => console.log("mock eSIM Access on :4010"));

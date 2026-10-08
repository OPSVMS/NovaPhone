// Cliente mínimo para eSIM Access. Uso:
//   node --env-file=.env scripts/esimaccess.mjs balance
//   node --env-file=.env scripts/esimaccess.mjs packages MX
//   node --env-file=.env scripts/esimaccess.mjs order <slug> [count]   (GASTA SALDO)
//   node --env-file=.env scripts/esimaccess.mjs query <orderNo>
const BASE = 'https://api.esimaccess.com/api/v1/open';
const ACCESS_CODE = process.env.ESIMACCESS_ACCESS_CODE;

async function call(path, body = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'RT-AccessCode': ACCESS_CODE, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${path}: ${json.errorCode} ${json.errorMsg}`);
  return json.obj;
}

const usd = (v) => (v / 10000).toFixed(2); // la API usa valor * 10,000
const gb = (bytes) => bytes / 1024 ** 3;

const [cmd, arg, arg2] = process.argv.slice(2);

if (cmd === 'balance') {
  const obj = await call('/balance/query');
  console.log(`Saldo: $${usd(obj.balance)} USD`);
} else if (cmd === 'packages') {
  const { packageList } = await call('/package/list', { locationCode: arg ?? 'MX', type: 'BASE' });
  const rows = packageList
    .map((p) => ({
      slug: p.slug,
      nombre: p.name,
      costo: +usd(p.price),
      precioSugerido: +usd(p.retailPrice ?? p.price),
      porGB: gb(p.volume) >= 1 ? +(usd(p.price) / gb(p.volume)).toFixed(2) : null,
      dias: p.duration,
      tipo: { 1: 'Total', 2: 'Diario (baja vel.)', 3: 'Diario (corte)', 4: 'Diario ilimitado' }[p.dataType] ?? p.dataType,
      red: (p.locationNetworkList ?? []).flatMap((l) => (l.operatorList ?? []).map((o) => `${o.operatorName} ${o.networkType ?? ''}`.trim())).join(', '),
      sms: p.smsStatus ? 'sí' : 'no',
    }))
    .sort((a, b) => a.costo - b.costo);
  console.table(rows);
} else if (cmd === 'order') {
  const count = Number(arg2 ?? 1);
  const transactionId = `novaphone-${Date.now()}`;
  const obj = await call('/esim/order', { transactionId, packageInfoList: [{ packageCode: arg, count }] });
  console.log('Orden creada:', obj.orderNo, '(transactionId', transactionId + ')');
  console.log(`Consulta en ~30s: node --env-file=.env scripts/esimaccess.mjs query ${obj.orderNo}`);
} else if (cmd === 'query') {
  const { esimList } = await call('/esim/query', { orderNo: arg, pager: { pageNum: 1, pageSize: 50 } });
  for (const e of esimList) {
    console.log({ iccid: e.iccid, estado: e.esimStatus, activacion: e.ac, qr: e.qrCodeUrl, link: e.shortUrl, apn: e.apn, numero: e.msisdn });
  }
} else {
  console.log('Comandos: balance | packages [PAIS] | order <slug> [count] | query <orderNo>');
}

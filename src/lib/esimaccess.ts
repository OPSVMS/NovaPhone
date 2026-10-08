import "server-only";

const BASE = "https://api.esimaccess.com/api/v1/open";

type ApiResponse<T> = { success: boolean; errorCode: string | null; errorMsg: string | null; obj: T };

export class EsimAccessError extends Error {
  constructor(public code: string | null, message: string) {
    super(message);
  }
}

async function call<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "RT-AccessCode": process.env.ESIMACCESS_ACCESS_CODE!, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new EsimAccessError(json.errorCode, `${path}: ${json.errorCode} ${json.errorMsg}`);
  return json.obj;
}

export type ProviderPackage = {
  packageCode: string;
  slug: string;
  name: string;
  price: number; // USD * 10,000
  volume: number; // bytes
  duration: number;
  durationUnit: string;
  location: string;
  dataType: number; // 1 total, 2-4 diarios
  speed?: string;
  locationNetworkList?: { locationName: string; operatorList?: { operatorName: string; networkType?: string }[] }[];
};

export type ProviderEsim = {
  esimTranNo: string;
  orderNo: string;
  iccid: string;
  ac: string;
  qrCodeUrl: string;
  shortUrl: string;
  apn: string;
  esimStatus: string;
  smdpStatus: string;
  totalVolume: number;
  orderUsage: number;
  expiredTime: string | null;
};

export const toUsd = (v: number) => v / 10_000;

export async function getBalanceUsd() {
  const obj = await call<{ balance: number }>("/balance/query");
  return toUsd(obj.balance);
}

export async function listPackages(locationCode: string) {
  const obj = await call<{ packageList: ProviderPackage[] }>("/package/list", { locationCode, type: "BASE" });
  return obj.packageList;
}

export async function orderEsim(transactionId: string, packageCode: string) {
  return call<{ orderNo: string }>("/esim/order", { transactionId, packageInfoList: [{ packageCode, count: 1 }] });
}

/** Regresa null si el proveedor aún está asignando el perfil (código 200010). */
export async function queryOrder(orderNo: string): Promise<ProviderEsim | null> {
  try {
    const obj = await call<{ esimList: ProviderEsim[] }>("/esim/query", { orderNo, pager: { pageNum: 1, pageSize: 5 } });
    return obj.esimList[0] ?? null;
  } catch (e) {
    if (e instanceof EsimAccessError && e.code === "200010") return null;
    throw e;
  }
}

export async function cancelEsim(esimTranNo: string) {
  return call("/esim/cancel", { esimTranNo });
}

export async function saveWebhook(url: string) {
  return call("/webhook/save", { webhook: url });
}

const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

/** Whole-peso price, e.g. 1829 → "$1,829". */
export const formatPesos = (mxn: number) => pesos.format(mxn);

/** Rounded price per GB, e.g. (599, 20) → "$30". */
export const formatPerGb = (mxn: number, gb: number) => pesos.format(Math.round(mxn / Math.max(gb, 0.1)));

export const formatDays = (days: number) => (days === 1 ? "1 día" : `${days} días`);

/** Price that always reads as pesos, e.g. 599 → "$599 MXN". */
export const formatMxn = (mxn: number) => `${pesos.format(mxn)} MXN`;

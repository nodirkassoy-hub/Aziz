/** Money in integer minor units (1/100). Deterministic throughout. */
export const CURRENCY_META: Record<string, { code: string; name: string; decimals: number; symbol: string; locale: string }> = {
  UZS: { code: "UZS", name: "Uzbekistani so'm", decimals: 0, symbol: "so'm", locale: "en-US" },
  USD: { code: "USD", name: "US dollar", decimals: 2, symbol: "$", locale: "en-US" },
  EUR: { code: "EUR", name: "Euro", decimals: 2, symbol: "€", locale: "de-DE" },
  RUB: { code: "RUB", name: "Russian ruble", decimals: 2, symbol: "₽", locale: "ru-RU" },
  GBP: { code: "GBP", name: "British pound", decimals: 2, symbol: "£", locale: "en-GB" },
  CNY: { code: "CNY", name: "Chinese yuan", decimals: 2, symbol: "¥", locale: "zh-CN" },
  KZT: { code: "KZT", name: "Kazakh tenge", decimals: 2, symbol: "₸", locale: "ru-KZ" },
};

export function currencyDecimals(code: string) { return CURRENCY_META[code]?.decimals ?? 2; }

/** minor units -> formatted string. `compact` renders 1.2M for chart axes. */
export function fmtMoney(minor: number | null | undefined, currency = "UZS", opts: { compact?: boolean; hideCode?: boolean; signed?: boolean } = {}): string {
  const meta = CURRENCY_META[currency] ?? { decimals: 2, code: currency, symbol: "", locale: "en-US" };
  const value = (minor ?? 0) / 100;
  if (opts.compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : opts.signed && value > 0 ? "+" : "";
    if (abs >= 1e9) return `${sign}${(value / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
    if (abs >= 1e6) return `${sign}${(value / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (abs >= 1e3) return `${sign}${(value / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
    return `${sign}${value.toFixed(0)}`;
  }
  const s = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals,
  }).format(value);
  if (opts.hideCode) return s;
  return `${s} ${currency}`;
}

export function fmtNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

export function fmtPct(x: number | null | undefined, decimals = 1): string {
  if (x === null || x === undefined || !isFinite(x)) return "—";
  return `${x > 0 ? "+" : ""}${(x * 100).toFixed(decimals)}%`;
}

/** "1 250 000.55" or "1.250.000,55" agnostic parse -> minor units. Accepts spaces & commas as thousands. */
export function parseMoney(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  let s = String(input ?? "").trim().replace(/\s|\u00A0/g, "");
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "").replace(/[^0-9.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  // decimal separator = whichever comes last; the other one is grouping
  let dec = -1;
  if (lastComma > lastDot) dec = lastComma; else if (lastDot >= 0) dec = lastDot;
  if (dec >= 0) {
    const frac = s.slice(dec + 1);
    if (frac.includes(",") || frac.includes(".")) { s = s.slice(0, dec) + s.slice(dec + 1).replace(/[.,]/g, ""); } // ambiguous grouping: drop separators
    else { s = s.slice(0, dec).replace(/[.,]/g, "") + "." + frac; }
  } else s = s.replace(/[.,]/g, "");
  const v = parseFloat(s) || 0;
  return Math.round(Math.abs(v) * 100) * (neg && v >= 0 ? -1 : 1) * (v < 0 ? -1 : 1);
}

export function minorToInput(minor: number | null | undefined, decimals = 2): string {
  const v = (minor ?? 0) / 100;
  return v.toFixed(decimals).replace(/\.00$/, "");
}

export function mulRate(minor: number, rate: number): number { return Math.round(minor * rate); }

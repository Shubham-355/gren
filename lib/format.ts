/** Indian-numbering formatting helpers used across every module. */

export function inr(value: number, opts?: { decimals?: boolean }): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts?.decimals ? 2 : 0,
    minimumFractionDigits: opts?.decimals ? 2 : 0,
  }).format(n);
}

export function inrPlain(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

/** ₹18,40,000 -> "18.4 lakh" for plain-language copy */
export function lakhs(value: number): string {
  const n = Math.abs(value);
  if (n >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)} crore`;
  if (n >= 1_00_000) return `${(value / 1_00_000).toFixed(2)} lakh`;
  return inrPlain(value);
}

export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(iso: string, from = new Date()): number {
  const target = new Date(iso);
  const ms = target.getTime() - from.getTime();
  return Math.ceil(ms / 86_400_000);
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string, currency = "TRY"): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

/** Expects value already in percent (e.g. 5.0 for 5%). Formats with tr-TR. */
export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "—";
  return `%${num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

/**
 * API returns rates as decimal (0.05 = 5%). Use this to display as percent with tr-TR locale.
 */
export function formatPercentFromDecimal(
  value: number | string | null | undefined,
  decimals = 2
): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "—";
  const pct = num * 100;
  return `%${pct.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatDecimal(
  value: number | string | null | undefined,
  digits = 2,
  minDigits?: number
): string {
  if (value == null) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "—";
  const options: Intl.NumberFormatOptions = {
    maximumFractionDigits: digits,
  };
  if (minDigits !== undefined) {
    options.minimumFractionDigits = minDigits;
  }
  return num.toLocaleString("tr-TR", options);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

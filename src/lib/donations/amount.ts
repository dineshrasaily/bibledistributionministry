/**
 * Donation amounts (USD only). Pure module: the server schema decides; the
 * client mirrors these limits only for hints.
 *
 * $5.00 minimum: well above Stripe's $0.50 floor and discourages card testing.
 * $10,000.00 maximum: limits fraud exposure for a small ministry.
 */
import type { AppLocale } from "@/i18n/routing";

export const DONATION_PRESETS_USD = [25, 50, 100, 250] as const;
export const MIN_CENTS = 500;
export const MAX_CENTS = 1_000_000;
export const MIN_USD = MIN_CENTS / 100;
export const MAX_USD = MAX_CENTS / 100;

const AMOUNT_RE = /^(\d{1,5})(?:\.(\d{1,2}))?$/;

/**
 * "25", "25.5", "$1,000", " 5 " -> cents. Integer math only (no floats).
 * Returns null for anything that is not a plain positive amount (signs,
 * exponents, 3+ decimals, more than 5 whole digits). Limits are checked by
 * the caller so it can say "too small" / "too large".
 */
export function parseUsdToCents(input: unknown): number | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (value.startsWith("$")) value = value.slice(1).trim();
  // Thousands separators only in valid positions ("1,000", not "1,0,0").
  if (value.includes(",")) {
    if (!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) return null;
    value = value.replaceAll(",", "");
  }
  const match = AMOUNT_RE.exec(value);
  if (!match) return null;
  const whole = Number.parseInt(match[1]!, 10);
  const fraction = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10);
  return whole * 100 + fraction;
}

const formatters: Partial<Record<AppLocale, Intl.NumberFormat>> = {};

/** 2500 -> "$25.00" (en) / the ne-NP rendering of US dollars. */
export function formatUsd(cents: number, locale: AppLocale = "en"): string {
  const fmt = (formatters[locale] ??= new Intl.NumberFormat(
    locale === "ne" ? "ne-NP" : "en-US",
    { style: "currency", currency: "USD" },
  ));
  return fmt.format(cents / 100);
}

/** Whole presets read better without ".00" ("$25"). */
export function formatPresetUsd(usd: number, locale: AppLocale = "en"): string {
  return new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(usd);
}

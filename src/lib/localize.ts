import type { AppLocale } from "@/i18n/routing";

/**
 * Bilingual column fallback: Nepali when present and non-blank, else English.
 * Pure module.
 */
export function pick<T extends string | null | undefined>(
  en: T,
  ne: string | null | undefined,
  locale: AppLocale,
): T | string {
  return locale === "ne" && ne != null && ne.trim() !== "" ? ne : en;
}

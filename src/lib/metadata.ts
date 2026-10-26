import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { localizedHref } from "./i18n-path";
import { getSiteSettings } from "./site-settings";

/**
 * Localized page metadata with canonical URL, hreflang alternates,
 * Open Graph and Twitter tags. URLs are relative to `metadataBase`
 * (set from NEXT_PUBLIC_SITE_URL in the locale layout).
 */
export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
}: {
  locale: AppLocale;
  /** Locale-less path, e.g. "/" or "/about". */
  path: string;
  title: string;
  description: string;
  siteName: string;
}): Metadata {
  const canonical = localizedHref(locale, path);
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, localizedHref(l, path)]),
  );
  languages["x-default"] = localizedHref(routing.defaultLocale, path);
  const ogLocale = (l: AppLocale) => (l === "ne" ? "ne_NP" : "en_US");

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: canonical,
      locale: ogLocale(locale),
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map(ogLocale),
    },
    twitter: { card: "summary", title, description },
  };
}

export type PageKey =
  | "home"
  | "about"
  | "devotionals"
  | "missions"
  | "media"
  | "prayer"
  | "support"
  | "contact"
  | "privacy"
  | "terms";

/** `generateMetadata` body shared by every locale page. */
export async function localizedPageMetadata(
  params: Promise<{ locale: string }>,
  key: PageKey,
  path: string,
): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const { ministryName: name } = await getSiteSettings();
  const metadata = buildPageMetadata({
    locale,
    path,
    siteName: name,
    title: key === "home" ? name : t(`${key}.title`),
    description: t(`${key}.description`, { name }),
  });
  // Home uses the bare site name, without the "%s | name" template.
  if (key === "home") metadata.title = { absolute: name };
  return metadata;
}

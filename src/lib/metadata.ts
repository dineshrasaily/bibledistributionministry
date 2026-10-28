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
export type OpenGraphExtras = {
  type?: "website" | "article";
  /** ISO date-times (articles). */
  publishedTime?: string;
  modifiedTime?: string;
  /** Absolute URLs or site paths (resolved against metadataBase). */
  images?: string[];
};

export function buildPageMetadata({
  locale,
  path,
  title,
  description,
  siteName,
  type = "website",
  publishedTime,
  modifiedTime,
  images,
}: {
  locale: AppLocale;
  /** Locale-less path, e.g. "/" or "/about". */
  path: string;
  title: string;
  description: string;
  siteName: string;
} & OpenGraphExtras): Metadata {
  const canonical = localizedHref(locale, path);
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, localizedHref(l, path)]),
  );
  languages["x-default"] = localizedHref(routing.defaultLocale, path);
  const ogLocale = (l: AppLocale) => (l === "ne" ? "ne_NP" : "en_US");

  const hasImages = images !== undefined && images.length > 0;
  const common = {
    siteName,
    title,
    description,
    url: canonical,
    locale: ogLocale(locale),
    alternateLocale: routing.locales.filter((l) => l !== locale).map(ogLocale),
    ...(hasImages ? { images } : {}),
  };

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph:
      type === "article"
        ? {
            ...common,
            type: "article",
            ...(publishedTime ? { publishedTime } : {}),
            ...(modifiedTime ? { modifiedTime } : {}),
          }
        : { ...common, type: "website" },
    twitter: {
      card: hasImages ? "summary_large_image" : "summary",
      title,
      description,
      ...(hasImages ? { images } : {}),
    },
  };
}

/** `generateMetadata` body for detail pages (posts, events). */
export async function localizedDetailMetadata({
  locale,
  path,
  title,
  description,
  ...og
}: {
  locale: AppLocale;
  path: string;
  title: string;
  description: string;
} & OpenGraphExtras): Promise<Metadata> {
  const { ministryName: siteName } = await getSiteSettings();
  return buildPageMetadata({
    locale,
    path,
    title,
    description,
    siteName,
    ...og,
  });
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
  | "terms"
  | "supportThanks"
  | "supportCancelled";

/** `generateMetadata` body shared by every locale page. */
export async function localizedPageMetadata(
  params: Promise<{ locale: string }>,
  key: PageKey,
  path: string,
  { noindex = false }: { noindex?: boolean } = {},
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
  // Result pages (thank-you / cancelled): never indexed, not in the sitemap.
  if (noindex) metadata.robots = { index: false, follow: false };
  return metadata;
}

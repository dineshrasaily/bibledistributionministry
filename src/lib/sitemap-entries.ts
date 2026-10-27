/**
 * Builds sitemap entries for every locale with hreflang alternates.
 * Pure module (the async sitemap route feeds it published slugs).
 */
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export type DynamicSitemapPath = { path: string; lastModified: Date };

export function buildSitemap(
  siteUrl: string,
  staticRoutes: readonly string[],
  dynamic: readonly DynamicSitemapPath[] = [],
  now: Date = new Date(),
): MetadataRoute.Sitemap {
  const base = siteUrl.replace(/\/$/, "");
  const entries: DynamicSitemapPath[] = [
    ...staticRoutes.map((path) => ({ path, lastModified: now })),
    ...dynamic,
  ].filter((e) => !e.path.startsWith("/admin"));

  return entries.flatMap(({ path, lastModified }) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${base}/${l}${path}`]),
        ),
      },
    })),
  );
}

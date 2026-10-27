import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/config/site";
import { getPublishedSlugs } from "@/lib/content";
import { buildSitemap } from "@/lib/sitemap-entries";

// Picks up newly published posts/events without a redeploy.
export const revalidate = 3600;

const STATIC_ROUTES = [
  "",
  "/about",
  "/devotionals",
  "/missions",
  "/media",
  "/prayer",
  "/support",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts, events } = await getPublishedSlugs();
  return buildSitemap(getSiteConfig().siteUrl, STATIC_ROUTES, [
    ...posts.map((p) => ({
      path: `/devotionals/${p.slug}`,
      lastModified: p.updatedAt,
    })),
    ...events.map((e) => ({
      path: `/missions/${e.slug}`,
      lastModified: e.updatedAt,
    })),
  ]);
}

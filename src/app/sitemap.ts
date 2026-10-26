import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/config/site";
import { routing } from "@/i18n/routing";

const routes = [
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
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteConfig().siteUrl.replace(/\/$/, "");
  const lastModified = new Date();

  return routes.flatMap((route) =>
    routing.locales.map((locale) => ({
      url: `${siteUrl}/${locale}${route}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${siteUrl}/${l}${route}`]),
        ),
      },
    })),
  );
}

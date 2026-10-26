import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteConfig().siteUrl.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

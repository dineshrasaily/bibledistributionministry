import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaderRules } from "./src/lib/security/headers";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Uploaded files on Vercel Blob (public store) plus the raster brand and
    // demo files. Everything else is rendered unoptimized (see SiteImage).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/media/**",
        search: "",
      },
    ],
    localPatterns: [
      { pathname: "/brand/**", search: "" },
      { pathname: "/demo/**", search: "" },
    ],
    maximumRedirects: 0,
  },
  async headers() {
    // CSP, HSTS, Referrer-Policy, Permissions-Policy, nosniff and
    // frame-ancestors on every route; stricter rules for admin and uploads.
    return securityHeaderRules({
      dev: process.env.NODE_ENV === "development",
      httpsSite: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith(
        "https://",
      ),
    });
  },
};
export default withNextIntl(nextConfig);

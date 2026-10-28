import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Admin and auth endpoints: never framed, indexed or cached. */
const adminHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    // No script-src: Next's inline bootstrap scripts would need nonces
    // (full CSP is backlog).
    value:
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

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
    return [
      // Site-wide (listed first so the admin rules below win on conflicts).
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
      { source: "/api/auth/:path*", headers: adminHeaders },
      { source: "/api/admin/:path*", headers: adminHeaders },
      {
        source: "/api/uploads/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      // Stripe webhook: machine-to-machine only.
      {
        source: "/api/stripe/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

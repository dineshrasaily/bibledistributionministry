/**
 * Security headers for every route, returned by next.config.ts `headers()`.
 * Pure (no imports), so next.config.ts can load it and it is unit-tested.
 *
 * CSP is a strict allow-list rather than nonces: nonces would force every
 * page to render dynamically (no static pages / ISR). Without nonces Next's
 * inline bootstrap scripts need 'unsafe-inline'; the only third-party script
 * host is Cloudflare Turnstile, and all HTML from content goes through the
 * server-side sanitizer (src/lib/markdown.ts). See README › Security notes.
 */

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const YOUTUBE_NOCOOKIE_ORIGIN = "https://www.youtube-nocookie.com";
export const STRIPE_FORM_ORIGINS = [
  "https://checkout.stripe.com",
  "https://billing.stripe.com",
] as const;
/** @vercel/blob browser client uploads go to https://vercel.com/api/blob. */
export const VERCEL_BLOB_API_ORIGIN = "https://vercel.com";

/** Same value as the uploads route sets itself (src/app/api/uploads/[...key]). */
export const UPLOADS_CSP =
  "default-src 'none'; sandbox; frame-ancestors 'none'";

export const HSTS = "max-age=63072000; includeSubDomains";
export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";

export type CspArea = "site" | "admin" | "uploads";
export type SecurityHeaderOptions = {
  /** `next dev`: React dev tooling needs eval, HMR needs websockets. */
  dev: boolean;
  /** NEXT_PUBLIC_SITE_URL is https: also send upgrade-insecure-requests. */
  httpsSite: boolean;
};

export function buildCsp(
  area: CspArea,
  { dev, httpsSite }: SecurityHeaderOptions,
): string {
  if (area === "uploads") return UPLOADS_CSP;
  const site = area === "site";
  const devEval = dev ? ["'unsafe-eval'"] : [];
  const devWs = dev ? ["ws:", "wss:"] : [];
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      ...devEval,
      ...(site ? [TURNSTILE_ORIGIN] : []),
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    // Owners may paste any https image/audio link (validated by isSafeUrl);
    // images and audio cannot run script.
    ["img-src", "'self'", "data:", "blob:", "https:"],
    ["media-src", "'self'", "blob:", "https:"],
    ["font-src", "'self'"],
    [
      "connect-src",
      "'self'",
      ...(site ? [TURNSTILE_ORIGIN] : [VERCEL_BLOB_API_ORIGIN]),
      ...devWs,
    ],
    site
      ? ["frame-src", TURNSTILE_ORIGIN, YOUTUBE_NOCOOKIE_ORIGIN]
      : ["frame-src", "'none'"],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    // A no-JS checkout form post follows a 303 to Stripe.
    ["form-action", "'self'", ...(site ? STRIPE_FORM_ORIGINS : [])],
    ["frame-ancestors", "'none'"],
  ];
  if (httpsSite) directives.push(["upgrade-insecure-requests"]);
  return directives.map((d) => d.join(" ")).join("; ");
}

type Header = { key: string; value: string };
export type HeaderRule = { source: string; headers: Header[] };

/**
 * Rule order matters: for a header set by several matching rules, Next uses
 * the last one, so the admin and uploads rules override the site-wide CSP.
 */
export function securityHeaderRules(
  options: SecurityHeaderOptions,
): HeaderRule[] {
  const adminHeaders: Header[] = [
    { key: "Content-Security-Policy", value: buildCsp("admin", options) },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
    { key: "Cache-Control", value: "no-store" },
  ];
  return [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: buildCsp("site", options) },
        { key: "Strict-Transport-Security", value: HSTS },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    },
    { source: "/admin", headers: adminHeaders },
    { source: "/admin/:path*", headers: adminHeaders },
    { source: "/api/auth/:path*", headers: adminHeaders },
    { source: "/api/admin/:path*", headers: adminHeaders },
    // Stripe webhook: machine-to-machine only.
    {
      source: "/api/stripe/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    },
    {
      source: "/api/uploads/:path*",
      headers: [
        { key: "Content-Security-Policy", value: buildCsp("uploads", options) },
      ],
    },
  ];
}

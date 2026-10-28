// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HSTS,
  PERMISSIONS_POLICY,
  UPLOADS_CSP,
  buildCsp,
  securityHeaderRules,
  type CspArea,
} from "./headers";

const PROD = { dev: false, httpsSite: false };
const PROD_HTTPS = { dev: false, httpsSite: true };
const DEV = { dev: true, httpsSite: false };

/** "a b; c d" -> { a: ["b"], c: ["d"] } */
function parse(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name!, values];
      }),
  );
}

describe("buildCsp: site", () => {
  const csp = parse(buildCsp("site", PROD));

  it("has the strict allow-list", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://challenges.cloudflare.com",
    ]);
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
    expect(csp["media-src"]).toEqual(["'self'", "blob:", "https:"]);
    expect(csp["font-src"]).toEqual(["'self'"]);
    expect(csp["connect-src"]).toEqual([
      "'self'",
      "https://challenges.cloudflare.com",
    ]);
    expect(csp["worker-src"]).toEqual(["'self'", "blob:"]);
    expect(csp["manifest-src"]).toEqual(["'self'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
  });

  it("frames only Turnstile and youtube-nocookie (never youtube.com)", () => {
    expect(csp["frame-src"]).toEqual([
      "https://challenges.cloudflare.com",
      "https://www.youtube-nocookie.com",
    ]);
    expect(buildCsp("site", PROD)).not.toMatch(/\/\/(www\.)?youtube\.com/);
  });

  it("lets forms redirect to Stripe Checkout and the billing portal", () => {
    expect(csp["form-action"]).toEqual([
      "'self'",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
    ]);
  });
});

describe("buildCsp: admin", () => {
  const csp = parse(buildCsp("admin", PROD));

  it("frames nothing and loads no third-party script", () => {
    expect(csp["frame-src"]).toEqual(["'none'"]);
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
  });

  it("allows Vercel Blob client uploads", () => {
    expect(csp["connect-src"]).toEqual(["'self'", "https://vercel.com"]);
  });
});

describe("buildCsp: all areas", () => {
  const areas: CspArea[] = ["site", "admin", "uploads"];

  it.each(areas)("%s forbids framing and plugins", (area) => {
    const csp = parse(buildCsp(area, PROD));
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    if (area === "uploads") {
      expect(csp["default-src"]).toEqual(["'none'"]);
    } else {
      expect(csp["object-src"]).toEqual(["'none'"]);
    }
  });

  it.each(["site", "admin"] as const)(
    "%s script-src has no wildcard, scheme or data source",
    (area) => {
      for (const options of [PROD, DEV, PROD_HTTPS]) {
        const scripts = parse(buildCsp(area, options))["script-src"]!;
        for (const value of scripts) {
          expect(value).not.toMatch(/^\*|^https?:$|^data:$|^blob:$/);
        }
        const hosts = scripts.filter((v) => v.startsWith("https://"));
        expect(hosts).toEqual(
          area === "site" ? ["https://challenges.cloudflare.com"] : [],
        );
      }
    },
  );

  it.each(["site", "admin"] as const)(
    "%s allows eval and websockets only in dev",
    (area) => {
      expect(buildCsp(area, PROD)).not.toContain("'unsafe-eval'");
      expect(buildCsp(area, PROD)).not.toMatch(/\bwss?:/);
      const dev = parse(buildCsp(area, DEV));
      expect(dev["script-src"]).toContain("'unsafe-eval'");
      expect(dev["connect-src"]).toEqual(
        expect.arrayContaining(["ws:", "wss:"]),
      );
    },
  );

  it.each(["site", "admin"] as const)(
    "%s upgrades insecure requests only on an https site",
    (area) => {
      expect(buildCsp(area, PROD)).not.toContain("upgrade-insecure-requests");
      expect(buildCsp(area, PROD_HTTPS)).toMatch(
        /; upgrade-insecure-requests$/,
      );
    },
  );

  it("the uploads CSP equals the one the uploads route sets itself", () => {
    const route = readFileSync(
      path.join(process.cwd(), "src/app/api/uploads/[...key]/route.ts"),
      "utf8",
    );
    const match = route.match(/"Content-Security-Policy":\s*"([^"]+)"/);
    expect(match?.[1]).toBe(UPLOADS_CSP);
    expect(buildCsp("uploads", PROD_HTTPS)).toBe(UPLOADS_CSP);
  });
});

describe("securityHeaderRules", () => {
  const rules = securityHeaderRules(PROD);
  const header = (source: string, key: string) =>
    rules.find((r) => r.source === source)?.headers.find((h) => h.key === key)
      ?.value;

  it("sends every security header on all routes", () => {
    expect(rules[0]!.source).toBe("/:path*");
    expect(
      Object.fromEntries(rules[0]!.headers.map((h) => [h.key, h.value])),
    ).toEqual({
      "Content-Security-Policy": buildCsp("site", PROD),
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    expect(HSTS).not.toContain("preload");
    // Not restricted: the YouTube iframe and the copy-link button need them.
    for (const feature of ["autoplay", "fullscreen", "clipboard-write"]) {
      expect(PERMISSIONS_POLICY).not.toContain(feature);
    }
  });

  it("overrides the CSP for admin and auth after the site-wide rule", () => {
    for (const source of [
      "/admin",
      "/admin/:path*",
      "/api/auth/:path*",
      "/api/admin/:path*",
    ]) {
      const index = rules.findIndex((r) => r.source === source);
      expect(index, source).toBeGreaterThan(0);
      expect(header(source, "Content-Security-Policy")).toBe(
        buildCsp("admin", PROD),
      );
      expect(header(source, "Referrer-Policy")).toBe("same-origin");
      expect(header(source, "Cache-Control")).toBe("no-store");
      expect(header(source, "X-Robots-Tag")).toBe("noindex, nofollow");
    }
  });

  it("puts the uploads rule last", () => {
    expect(rules.at(-1)!.source).toBe("/api/uploads/:path*");
    expect(header("/api/uploads/:path*", "Content-Security-Policy")).toBe(
      UPLOADS_CSP,
    );
  });

  it("keeps the Stripe webhook uncached and unindexed", () => {
    expect(header("/api/stripe/:path*", "Cache-Control")).toBe("no-store");
    expect(header("/api/stripe/:path*", "X-Robots-Tag")).toBe(
      "noindex, nofollow",
    );
  });
});

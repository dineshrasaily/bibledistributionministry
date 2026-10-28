import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { scrollWidth } from "./helpers/admin";
import {
  collectConsoleErrors,
  collectCspViolations,
  cspViolations,
  seriousViolations,
  stubYouTube,
} from "./helpers/axe";
import { stubTurnstile, waitForTurnstile } from "./helpers/turnstile";

/**
 * Phase 9: every public page in en + ne at 1280 and 375. axe (no
 * serious/critical), no CSP violations, no console errors, plus the
 * Lighthouse SEO / best-practice items (see README › Known limitations).
 */

type PageSpec = {
  path: string;
  status?: number;
  /** Forms: Turnstile is stubbed (never contacts Cloudflare). */
  form?: boolean;
  /** noindex pages: no canonical/hreflang/og:image requirement. */
  noindex?: boolean;
};

const PAGES: PageSpec[] = [
  { path: "/" },
  { path: "/about" },
  { path: "/devotionals" },
  { path: "/devotionals?q=sample" },
  { path: "/devotionals/sample-devotional-here-i-am" },
  { path: "/missions" },
  { path: "/missions/sample-past-gathering" },
  { path: "/media" },
  { path: "/prayer", form: true },
  { path: "/contact", form: true },
  { path: "/support" },
  { path: "/support/thank-you", noindex: true },
  { path: "/support/cancelled", noindex: true },
  { path: "/privacy" },
  { path: "/terms" },
  { path: "/does-not-exist", status: 404, noindex: true },
];

const localized = (locale: string, p: string) =>
  p === "/" ? `/${locale}` : `/${locale}${p}`;

async function lighthouseStyleChecks(
  page: Page,
  locale: string,
  spec: PageSpec,
  width: number,
) {
  await expect(page.locator("h1")).toHaveCount(1);
  expect((await page.title()).trim()).not.toBe("");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /width=device-width/,
  );
  if (spec.noindex) {
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  } else {
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/${locale}(/|$)`),
    );
    for (const lang of ["en", "ne", "x-default"]) {
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
      ).toHaveCount(1);
    }
    await expect(
      page.locator('meta[property="og:image"]').first(),
    ).toHaveAttribute("content", /\S/);
  }
  // Every image has an alt attribute (decorative ones use alt="").
  expect(
    await page
      .locator("img:not([alt])")
      .evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src)),
  ).toEqual([]);
  if (width === 375) {
    expect(await scrollWidth(page)).toBeLessThanOrEqual(375);
  }
}

for (const locale of ["en", "ne"]) {
  for (const spec of PAGES) {
    for (const width of [1280, 375]) {
      const url = localized(locale, spec.path);
      test(`${url} at ${width}px: axe, CSP, console, SEO checks`, async ({
        page,
      }) => {
        await stubYouTube(page);
        if (spec.form) await stubTurnstile(page);
        await collectCspViolations(page);
        const errors = collectConsoleErrors(page, {
          // The 404 page's own document status is logged by Chrome.
          ignore: spec.status === 404 ? [/status of 404/] : [],
        });
        await page.setViewportSize({ width, height: 900 });
        const res = await page.goto(url);
        expect(res?.status()).toBe(spec.status ?? 200);
        if (spec.form) await waitForTurnstile(page);
        await page.evaluate(() => document.fonts.ready);
        await lighthouseStyleChecks(page, locale, spec, width);
        expect(await seriousViolations(page, `${width}px`)).toEqual([]);
        expect(await cspViolations(page)).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
  }
}

test("performance snapshot for /en and /ne at 375 (recorded, not asserted)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const results: Record<string, unknown> = {};
  for (const locale of ["en", "ne"]) {
    await page.goto(`/${locale}`);
    await page
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => {});
    results[`/${locale}`] = await page.evaluate(() => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const sum = (list: PerformanceResourceTiming[]) =>
        list.reduce((n, r) => n + (r.transferSize || r.encodedBodySize), 0);
      const scripts = resources.filter((r) => r.initiatorType === "script");
      const fcp = performance
        .getEntriesByType("paint")
        .find((p) => p.name === "first-contentful-paint");
      return {
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
        documentBytes: nav.transferSize || nav.encodedBodySize,
        scriptCount: scripts.length,
        scriptBytes: sum(scripts),
        totalResourceBytes: sum(resources),
      };
    });
  }
  const dir = path.join(process.cwd(), ".agents", "tasks", "phase9");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "perf.json"),
    `${JSON.stringify(
      {
        note: "Local production build (next start) on localhost, Desktop Chrome at 375x812, no throttling. Informational only.",
        recordedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    )}\n`,
  );
});

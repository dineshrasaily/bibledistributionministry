import { expect, test, type APIResponse, type Page } from "@playwright/test";
import {
  collectConsoleErrors,
  collectCspViolations,
  cspViolations,
  stubYouTube,
} from "./helpers/axe";
import { stubTurnstile, waitForTurnstile } from "./helpers/turnstile";

/** Phase 9: security headers on every kind of route, and no CSP violations. */

const HSTS = "max-age=63072000; includeSubDomains";
const PERMISSIONS =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";

function expectCommon(res: APIResponse, label: string) {
  const h = res.headers();
  const csp = h["content-security-policy"] ?? "";
  expect(csp, label).toContain("frame-ancestors 'none'");
  expect(h["strict-transport-security"], label).toBe(HSTS);
  expect(h["permissions-policy"], label).toBe(PERMISSIONS);
  expect(h["x-content-type-options"], label).toBe("nosniff");
  expect(h["x-frame-options"], label).toBe("DENY");
  // http E2E build: no upgrade (it would break http://localhost).
  expect(csp, label).not.toContain("upgrade-insecure-requests");
  expect(csp, label).not.toContain("'unsafe-eval'");
  return { h, csp };
}

test.describe("headers", () => {
  const SITE: [string, "get" | "post", number][] = [
    ["/en", "get", 200],
    ["/ne/devotionals", "get", 200],
    ["/en/support", "get", 200],
    ["/en/does-not-exist", "get", 404],
    ["/robots.txt", "get", 200],
    ["/sitemap.xml", "get", 200],
    ["/icon.png", "get", 200],
    ["/brand/og-default.png", "get", 200],
    ["/api/stripe/webhook", "post", 503],
  ];
  for (const [path, method, status] of SITE) {
    test(`${method.toUpperCase()} ${path} has the site-wide headers`, async ({
      request,
    }) => {
      const res =
        method === "get"
          ? await request.get(path, { maxRedirects: 0 })
          : await request.post(path, { data: "{}", maxRedirects: 0 });
      expect(res.status()).toBe(status);
      const { h, csp } = expectCommon(res, path);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain(
        "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com",
      );
      expect(csp).toContain(
        "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
      );
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    });
  }

  for (const [path, redirect] of [
    ["/admin/login", false],
    ["/admin", true],
    ["/api/auth/session", false],
  ] as const) {
    test(`${path} has the admin headers`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      if (redirect) expect(res.status()).toBe(307);
      else expect(res.status()).toBe(200);
      const { h, csp } = expectCommon(res, path);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
      expect(csp).toContain("connect-src 'self' https://vercel.com");
      expect(csp).not.toContain("challenges.cloudflare.com");
      expect(h["referrer-policy"]).toBe("same-origin");
      expect(h["cache-control"]).toContain("no-store");
      expect(h["x-robots-tag"]).toBe("noindex, nofollow");
    });
  }

  test("uploads get the sandbox CSP", async ({ request }) => {
    const res = await request.get("/api/uploads/does-not-exist/x.png");
    expect(res.status()).toBe(404);
    const { csp } = expectCommon(res, "uploads");
    expect(csp).toBe("default-src 'none'; sandbox; frame-ancestors 'none'");
  });
});

test.describe("no CSP violations or console errors", () => {
  async function open(page: Page, path: string) {
    await collectCspViolations(page);
    const errors = collectConsoleErrors(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    return errors;
  }
  async function expectClean(page: Page, errors: string[]) {
    expect(await cspViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  }

  for (const path of [
    "/en",
    "/ne",
    "/en/devotionals/sample-devotional-here-i-am",
    "/en/support",
    "/admin/login",
  ]) {
    test(path, async ({ page }) => {
      const errors = await open(page, path);
      await page
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => {});
      await expectClean(page, errors);
    });
  }

  test("mission detail with the lightbox open", async ({ page }) => {
    const errors = await open(page, "/en/missions/sample-past-gathering");
    await page.getByTestId("gallery-thumb").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectClean(page, errors);
  });

  test("media center after loading the YouTube player", async ({ page }) => {
    await stubYouTube(page);
    const errors = await open(page, "/en/media");
    await page
      .getByRole("button", { name: "Play video: E2E fixture video" })
      .click();
    const frame = page.locator("iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute(
      "src",
      /^https:\/\/www\.youtube-nocookie\.com\/embed\//,
    );
    // The stubbed document loaded inside the frame (CSP allowed it).
    await expect
      .poll(() => page.frames().some((f) => f.url().includes("nocookie")))
      .toBe(true);
    await expectClean(page, errors);
  });

  for (const path of ["/en/prayer", "/ne/contact"]) {
    test(`${path} with the Turnstile widget`, async ({ page }) => {
      await stubTurnstile(page);
      const errors = await open(page, path);
      await waitForTurnstile(page);
      await expectClean(page, errors);
    });
  }
});

import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OWNER_STATE, scrollWidth } from "./helpers/admin";
import { LOGO_MARK, setLogo } from "./helpers/branding";

/** Phase 9 screenshots (with the user's logo set in Settings). */

const DIR = path.join(process.cwd(), ".agents", "screenshots", "phase9");
mkdirSync(DIR, { recursive: true });

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial", timeout: 120_000 });

const LOCALES = ["en", "ne"] as const;
const WIDTHS = [1280, 375] as const;

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => {});
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? null
          : new Promise((r) => (img.onload = img.onerror = r)),
      ),
    ),
  );
}

async function shot(
  page: Page,
  name: string,
  width: number,
  { fullPage = true, target }: { fullPage?: boolean; target?: Locator } = {},
) {
  await settle(page);
  expect(await scrollWidth(page)).toBeLessThanOrEqual(width);
  const file = path.join(DIR, `${name}.png`);
  if (target) {
    // Clip a full-page capture to the element: an element screenshot of a
    // section taller than the viewport stitches the sticky header over it.
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    await page.screenshot({ path: file, fullPage: true, clip: box! });
    return;
  }
  await page.screenshot({ path: file, fullPage });
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setLogo(page, LOGO_MARK);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setLogo(page, "");
  await page.close();
});

test("home and footer in en and ne at 1280 and 375", async ({ page }) => {
  for (const locale of LOCALES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      await page.goto(`/${locale}`);
      await expect(
        page.locator(`footer img[src="${LOGO_MARK}"]`),
      ).toBeVisible();
      await shot(page, `home-${locale}-${width}`, width);
      await shot(page, `footer-${locale}-${width}`, width, {
        target: page.locator("footer"),
      });
    }
  }
});

test("the public header is unchanged (en, 1280)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en");
  await shot(page, "header-unchanged-en-1280", 1280, {
    target: page.locator("header").first(),
  });
});

test("admin login with the logo at 1280 and 375", async ({ browser }) => {
  // test.use({ storageState }) also applies here: sign out explicitly.
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    await page.goto("/admin/login");
    await expect(page.locator(`main img[src="${LOGO_MARK}"]`)).toBeVisible();
    await shot(page, `admin-login-${width}`, width);
  }
  await context.close();
});

test("admin sidebar at a short laptop height (1280x650)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.goto("/admin");
  const logout = page
    .getByRole("complementary")
    .getByRole("button", { name: "Log out" });
  await expect(logout).toBeInViewport({ ratio: 1 });
  await shot(page, "admin-dashboard-1280x650", 1280, { fullPage: false });
  await page
    .getByTestId("admin-sidebar-scroll")
    .evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(logout).toBeInViewport({ ratio: 1 });
  await shot(page, "admin-sidebar-scrolled-1280x650", 1280, {
    fullPage: false,
  });
});

test("mobile admin menu at 375x650", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 650 });
  await page.goto("/admin");
  await page.getByTestId("admin-menu-trigger").click();
  const dialog = page.getByRole("dialog", { name: "Admin menu" });
  await expect(dialog.getByRole("button", { name: "Log out" })).toBeInViewport({
    ratio: 1,
  });
  await shot(page, "admin-mobile-menu-375x650", 375, { fullPage: false });
});

test("generated icons and the default social image", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/brand/og-default.png");
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.screenshot({ path: path.join(DIR, "og-default.png") });

  await page.setViewportSize({ width: 1280, height: 900 });
  // A same-origin HTML page (the images load under the site's CSP); its
  // content is replaced by the contact sheet below.
  await page.goto("/robots.txt");
  const strip = (bg: string, fg: string) => `
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:24px;padding:24px;background:${bg};color:${fg}">
      <figure><img src="${baseURL}/icon.png" width="256" height="256" alt="icon.png at 256"><figcaption>icon.png (256)</figcaption></figure>
      <figure><img src="${baseURL}/icon.png" width="32" height="32" alt="icon.png at 32"><figcaption>32</figcaption></figure>
      <figure><img src="${baseURL}/icon.png" width="16" height="16" alt="icon.png at 16"><figcaption>16</figcaption></figure>
      <figure><img src="${baseURL}/apple-icon.png" width="180" height="180" alt="apple-icon.png"><figcaption>apple-icon.png (180)</figcaption></figure>
      <figure><img src="${baseURL}/brand/og-default.png" width="480" height="252" alt="og-default.png"><figcaption>og-default.png</figcaption></figure>
    </div>`;
  const sheet = `${strip("#ffffff", "#1E2A44")}${strip("#141C2F", "#ffffff")}`;
  await page.evaluate((html) => {
    document.documentElement.lang = "en";
    document.body.style.cssText =
      "margin:0;font:14px system-ui,sans-serif;white-space:normal";
    document.body.innerHTML = html;
  }, sheet);
  // Every image actually decoded (not a broken-image box).
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.images].every((i) => i.complete && i.naturalWidth > 0),
      ),
    )
    .toBe(true);
  await settle(page);
  await page.screenshot({
    path: path.join(DIR, "brand-assets.png"),
    fullPage: true,
  });
});

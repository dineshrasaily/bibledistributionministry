import { expect, test } from "@playwright/test";

/** Phase 9 (read-only): icons, default social image, logo fallbacks. */

for (const path of ["/en", "/admin/login"]) {
  test(`${path} links the generated icons`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.locator('head link[rel="icon"][href^="/icon.png"]'),
    ).toHaveAttribute("type", "image/png");
    await expect(
      page.locator(
        'head link[rel="apple-touch-icon"][href^="/apple-icon.png"]',
      ),
    ).toHaveCount(1);
    await expect(page.locator('head link[href^="/icon.svg"]')).toHaveCount(0);
  });
}

test("the icons and the default social image are PNGs; icon.svg is gone", async ({
  request,
}) => {
  for (const path of [
    "/icon.png",
    "/apple-icon.png",
    "/brand/og-default.png",
  ]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toBe("image/png");
  }
  expect((await request.get("/icon.svg")).status()).toBe(404);
});

for (const path of ["/en", "/ne/about", "/en/support"]) {
  test(`${path} has the default Open Graph image`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.locator('meta[property="og:image"]').first(),
    ).toHaveAttribute("content", /\/brand\/og-default\.png$/);
    await expect(
      page.locator('meta[property="og:image:width"]').first(),
    ).toHaveAttribute("content", "1200");
    await expect(
      page.locator('meta[property="og:image:height"]').first(),
    ).toHaveAttribute("content", "630");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(
      page.locator('meta[name="twitter:image"]').first(),
    ).toHaveAttribute("content", /\/brand\/og-default\.png$/);
  });
}

test("without a logo in Settings, the footer and login show the built-in mark", async ({
  page,
}) => {
  await page.goto("/en");
  const footer = page.locator("footer");
  await expect(footer.locator('svg[aria-hidden="true"]').first()).toBeVisible();
  await expect(footer.locator("img")).toHaveCount(0);
  await page.goto("/admin/login");
  const main = page.locator("main");
  await expect(main.locator('svg[aria-hidden="true"]').first()).toBeVisible();
  await expect(main.locator("img")).toHaveCount(0);
});

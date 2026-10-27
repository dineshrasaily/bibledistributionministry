import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const outDir = path.join(process.cwd(), ".agents", "screenshots", "phase3");

const PAGES = [
  ["about", "/about"],
  ["devotionals", "/devotionals"],
  ["devotionals-filtered", "/devotionals?type=DEVOTIONAL"],
  ["devotional-detail", "/devotionals/sample-devotional-here-i-am"],
  ["missions", "/missions"],
  ["mission-detail", "/missions/sample-past-gathering"],
  ["media", "/media"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
] as const;

async function settle(page: Page, width: number) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

for (const locale of ["en", "ne"]) {
  for (const width of [375, 1280]) {
    for (const [name, route] of PAGES) {
      test(`screenshot ${name} ${locale} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}${route}`);
        await settle(page, width);
        await page.screenshot({
          path: path.join(outDir, `${name}-${locale}-${width}.png`),
          fullPage: true,
        });
      });
    }
  }
}

for (const width of [375, 1280]) {
  test(`screenshot mission-detail lightbox en @ ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/missions/sample-past-gathering");
    await settle(page, width);
    await page.getByTestId("gallery-thumb").nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll("img")].map((img) =>
          img.complete ? null : img.decode().catch(() => null),
        ),
      ),
    );
    await page.screenshot({
      path: path.join(outDir, `mission-detail-lightbox-en-${width}.png`),
    });
  });
}

test("screenshot media with a loaded video en @ 1280px", async ({ page }) => {
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body style='margin:0;background:#141c2f;color:#fff;font:16px sans-serif;display:grid;place-items:center;height:100vh'>YouTube player (stubbed in tests)</body></html>",
    }),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en/media");
  await settle(page, 1280);
  await page
    .getByRole("button", { name: "Play video: E2E fixture video" })
    .click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(outDir, "media-video-loaded-en-1280.png"),
    fullPage: true,
  });
});

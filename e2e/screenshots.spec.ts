import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const outDir = path.join(process.cwd(), ".agents", "screenshots");

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

for (const locale of ["en", "ne"]) {
  for (const width of [375, 768, 1280]) {
    test(`screenshot home ${locale} @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}`);
      await settle(page);

      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(scrollWidth).toBeLessThanOrEqual(width);

      await page.screenshot({
        path: path.join(outDir, `home-${locale}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

test("screenshot home ne @ 375px with the mobile menu open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ne");
  await settle(page);
  await page.locator('[data-testid="mobile-menu-trigger"]').click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: path.join(outDir, "home-ne-375-menu-open.png"),
  });
});

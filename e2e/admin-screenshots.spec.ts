import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_SCREENSHOTS, OWNER_STATE, scrollWidth } from "./helpers/admin";

const PHASE3_SCREENSHOTS = path.join(
  process.cwd(),
  ".agents",
  "screenshots",
  "phase3",
);

const SIZES = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

async function capture(page: Page, name: string, width: number) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  expect(await scrollWidth(page)).toBeLessThanOrEqual(width);
  await page.screenshot({
    path: path.join(ADMIN_SCREENSHOTS, `${name}-${width}.png`),
    fullPage: true,
  });
}

for (const size of SIZES) {
  test(`screenshot admin login @ ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/admin/login");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    await capture(page, "login", size.width);
  });
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  for (const size of SIZES) {
    test(`screenshot admin dashboard @ ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/admin");
      await expect(page.getByText("Published posts")).toBeVisible();
      await capture(page, "dashboard", size.width);
    });

    test(`screenshot admin post editor @ ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/admin/posts/new");
      await expect(page.getByLabel(/Title \(English\)/)).toBeVisible();
      await capture(page, "post-editor", size.width);
    });

    test(`screenshot admin settings @ ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/admin/settings");
      await expect(page.getByLabel(/^Ministry name/)).toBeVisible();
      await capture(page, "settings", size.width);
    });
  }

  test("screenshot admin settings About section (Phase 3) @ 1280px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/settings");
    const heading = page.getByRole("heading", { name: "About page" });
    await heading.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await heading.evaluate((el) => el.scrollIntoView({ block: "start" }));
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);
    await page.screenshot({
      path: path.join(PHASE3_SCREENSHOTS, "admin-settings-about-1280.png"),
    });
  });

  test("screenshot admin media editor (Phase 3) @ 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/media/new");
    await expect(
      page.getByLabel("Linked mission/event (optional)"),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);
    await page.screenshot({
      path: path.join(PHASE3_SCREENSHOTS, "admin-media-editor-1280.png"),
      fullPage: true,
    });
  });
});

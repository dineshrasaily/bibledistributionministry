import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OWNER_STATE, scrollWidth } from "./helpers/admin";
import { verseSection } from "./helpers/verse-of-day";

const DIR = path.join(process.cwd(), ".agents", "screenshots", "verse-of-day");
mkdirSync(DIR, { recursive: true });

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial", timeout: 180_000 });

const SIZES = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

async function settle(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => {});
  expect(await scrollWidth(page)).toBeLessThanOrEqual(width);
}

async function shot(page: Page, name: string, target?: Locator) {
  if (target) {
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: path.join(DIR, `${name}.png`) });
    return;
  }
  await page.screenshot({ path: path.join(DIR, `${name}.png`) });
}

test("verse of the day: home (en + ne) and the admin screens", async ({
  page,
}) => {
  for (const locale of ["en", "ne"] as const) {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.goto(`/${locale}`);
      await expect(verseSection(page).locator("cite")).toBeVisible();
      await settle(page, size.width);
      // Header + hero (header must look unchanged), then the verse section.
      await shot(page, `home-top-${locale}-${size.width}`);
      await shot(
        page,
        `home-verse-${locale}-${size.width}`,
        verseSection(page),
      );
    }
  }

  await page.setViewportSize(SIZES[0]);
  await page.goto("/admin/settings");
  await page.addStyleTag({
    content: ".sticky { position: static !important; }",
  });
  const section = page
    .getByRole("heading", { level: 2, name: "Verse of the day" })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
  await settle(page, SIZES[0].width);
  await shot(page, "admin-settings-verse-1280", section);

  await page.goto("/admin/verses");
  await expect(page.getByTestId("today-verse-preview")).toBeVisible();
  await settle(page, SIZES[0].width);
  await shot(page, "admin-verses-preview-1280");
});

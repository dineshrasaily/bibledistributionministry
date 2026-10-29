import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OWNER_STATE, scrollWidth } from "./helpers/admin";
import {
  E2E_OFFLINE,
  fillOfflineGiving,
  resetOfflineGiving,
} from "./helpers/offline-giving";

const DIR = path.join(process.cwd(), ".agents", "screenshots", "zelle-bank");
mkdirSync(DIR, { recursive: true });

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial", timeout: 180_000 });

const SIZES = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

async function shot(page: Page, name: string, width: number, target?: Locator) {
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
  expect(await scrollWidth(page)).toBeLessThanOrEqual(width);
  if (target) {
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: path.join(DIR, `${name}.png`) });
    return;
  }
  await page.screenshot({
    path: path.join(DIR, `${name}.png`),
    fullPage: true,
  });
}

test("Zelle and bank transfer: Support (en + ne) and Admin -> Settings", async ({
  page,
}) => {
  try {
    await fillOfflineGiving(page, { ...E2E_OFFLINE, showDetails: true });
    for (const locale of ["en", "ne"] as const) {
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await page.goto(`/${locale}/support`);
        await expect(page.getByTestId("support-offline")).toBeVisible();
        await shot(page, `support-${locale}-${size.width}`, size.width);
      }
    }

    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.goto("/admin/settings");
      // Element shots taller than the viewport are stitched: keep the sticky
      // admin header and Save bar out of the middle of the picture.
      await page.addStyleTag({
        content: ".sticky { position: static !important; }",
      });
      const section = page
        .getByRole("heading", { level: 2, name: "Zelle and bank transfer" })
        .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
      await shot(page, `admin-zelle-bank-${size.width}`, size.width, section);
    }

    // Default (safer) state: account details off.
    await fillOfflineGiving(page, { showDetails: false });
    await page.setViewportSize(SIZES[1]);
    await page.goto("/en/support");
    await expect(page.getByTestId("bank-contact-for-details")).toBeVisible();
    await shot(page, "support-en-375-details-off", 375);
  } finally {
    await page.setViewportSize(SIZES[0]);
    await resetOfflineGiving(page);
  }
});

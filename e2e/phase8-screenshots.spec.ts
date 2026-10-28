import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OWNER_STATE, scrollWidth } from "./helpers/admin";
import {
  demoWebhookEvents,
  DONATIONS_ENABLED,
  setSettingsCheckbox,
  signedWebhook,
  startStripeE2e,
  TAX_VERIFIED,
  type StripeE2e,
} from "./helpers/stripe-server";

const DIR = path.join(process.cwd(), ".agents", "screenshots", "phase8");
mkdirSync(DIR, { recursive: true });

test.use({ storageState: OWNER_STATE });
// Several full-page shots per test.
test.describe.configure({ mode: "serial", timeout: 120_000 });

const SIZES = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;
const LOCALES = ["en", "ne"] as const;

let stripe: StripeE2e;

async function shot(
  page: Page,
  name: string,
  width: number,
  { fullPage = true, target }: { fullPage?: boolean; target?: Locator } = {},
) {
  await page.evaluate(() => document.fonts.ready);
  // Link prefetches can keep the network busy under load: bounded wait.
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
  await page.screenshot({ path: path.join(DIR, `${name}.png`), fullPage });
}

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(180_000);
  stripe = await startStripeE2e();
  // Rows for the admin page (duplicates of the checkout spec are no-ops).
  for (const event of demoWebhookEvents()) {
    const { payload, header } = signedWebhook(event);
    const res = await request.post(`${stripe.baseUrl}/api/stripe/webhook`, {
      headers: {
        "content-type": "application/json",
        "stripe-signature": header,
      },
      data: payload,
    });
    expect(res.status()).toBe(200);
  }
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setSettingsCheckbox(page, DONATIONS_ENABLED, false);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setSettingsCheckbox(page, TAX_VERIFIED, false);
  await setSettingsCheckbox(page, DONATIONS_ENABLED, false);
  await page.close();
  await stripe?.stop();
});

for (const locale of LOCALES) {
  for (const size of SIZES) {
    test(`support not configured + result pages (${locale}) @ ${size.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(`/${locale}/support`);
      await expect(page.getByTestId("support-not-configured")).toBeVisible();
      await shot(
        page,
        `support-not-configured-${locale}-${size.width}`,
        size.width,
      );

      await page.goto(`/${locale}/support/thank-you?session_id=cs_test_x`);
      await shot(page, `support-thank-you-${locale}-${size.width}`, size.width);

      if (size.width === 1280) {
        await page.goto(`/${locale}/support/cancelled`);
        await shot(page, `support-cancelled-${locale}-1280`, 1280);
      }
    });
  }
}

test("support open (mock Stripe keys) in en and ne", async ({ page }) => {
  await setSettingsCheckbox(page, DONATIONS_ENABLED, true);
  for (const locale of LOCALES) {
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.goto(`${stripe.baseUrl}/${locale}/support`);
      await expect(page.getByTestId("support-open")).toBeVisible();
      await shot(page, `support-open-${locale}-${size.width}`, size.width);
    }
  }

  // Validation error on the custom amount (375).
  await page.setViewportSize(SIZES[1]);
  await page.goto(`${stripe.baseUrl}/en/support`);
  await page.locator('label[for="donation-amount-custom"]').click();
  await page.locator("#donation-customAmount").fill("4");
  await page
    .getByRole("button", { name: "Continue to secure payment" })
    .click();
  await expect(page.getByText("The smallest gift online is $5.")).toBeVisible();
  await shot(page, "support-open-other-amount-error-en-375", 375, {
    target: page.getByRole("form", { name: "Give online" }),
  });

  // Monthly selected (1280).
  await page.setViewportSize(SIZES[0]);
  await page.goto(`${stripe.baseUrl}/en/support`);
  await page.locator('label[for="donation-interval-MONTHLY"]').click();
  await page.locator('label[for="donation-amount-100"]').click();
  await expect(
    page.getByRole("button", { name: "Continue to set up monthly gift" }),
  ).toBeVisible();
  await shot(page, "support-open-monthly-en-1280", 1280, {
    target: page.getByTestId("support-open"),
  });

  // Verified tax wording (1280).
  await setSettingsCheckbox(page, TAX_VERIFIED, true);
  await page.goto(`${stripe.baseUrl}/en/support`);
  await expect(page.getByTestId("support-tax-note")).toContainText(
    "may be tax-deductible",
  );
  await shot(page, "support-open-verified-wording-en-1280", 1280, {
    target: page.getByTestId("support-open"),
  });
  await setSettingsCheckbox(page, TAX_VERIFIED, false);
});

test("admin donations, settings and header", async ({ page }) => {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto("/admin/donations?period=all");
    await expect(
      page.getByRole("list", { name: "Donations" }).getByRole("listitem"),
    ).toHaveCount(2);
    await shot(page, `admin-donations-${size.width}`, size.width);
  }
  await page.setViewportSize(SIZES[0]);
  await page.goto("/admin/donations?period=last-year");
  await expect(page.getByText("No gifts in this period")).toBeVisible();
  await shot(page, "admin-donations-empty-status-1280", 1280);

  await page.goto("/admin/settings");
  const section = page
    .getByRole("heading", { level: 2, name: "Donations" })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
  await shot(page, "admin-settings-donations-1280", 1280, { target: section });

  await page.goto("/en");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(DIR, "header-unchanged-en-1280.png"),
  });
});

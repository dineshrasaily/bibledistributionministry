import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { stubTurnstile, waitForTurnstile } from "./helpers/turnstile";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const summary = serious.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  console.log(
    `[axe] ${page.url()} violations=${results.violations.length} serious/critical=${serious.length} passes=${results.passes.length}`,
  );
  return summary;
}

const PHASE3_PAGES = [
  "/about",
  "/devotionals",
  "/devotionals/sample-devotional-here-i-am",
  "/missions",
  "/missions/sample-past-gathering",
  "/media",
  "/privacy",
  "/terms",
];
const PHASE3_MOBILE = ["/about", "/devotionals", "/missions", "/media"];

for (const locale of ["en", "ne"]) {
  for (const path of PHASE3_PAGES) {
    const widths = PHASE3_MOBILE.includes(path) ? [1280, 375] : [1280];
    for (const width of widths) {
      test(`/${locale}${path} at ${width}px has no serious/critical axe violations`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}${path}`);
        await page.evaluate(() => document.fonts.ready);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }
}

// Phase 6 forms (Turnstile is stubbed: no Cloudflare requests in tests).
for (const locale of ["en", "ne"]) {
  for (const path of ["/prayer", "/contact"]) {
    for (const width of [1280, 375]) {
      test(`/${locale}${path} at ${width}px has no serious/critical axe violations`, async ({
        page,
      }) => {
        await stubTurnstile(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}${path}`);
        await waitForTurnstile(page);
        await page.evaluate(() => document.fonts.ready);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }
}

test("the contact form with Testimony selected has no serious/critical axe violations", async ({
  page,
}) => {
  await stubTurnstile(page);
  await page.goto("/en/contact");
  await page.getByLabel("What is this about?").selectOption("TESTIMONY");
  await expect(
    page.getByRole("checkbox", { name: /share a shortened version/ }),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

for (const locale of ["en", "ne"]) {
  test(`the prayer form error state (${locale}) has no serious/critical axe violations`, async ({
    page,
  }) => {
    await stubTurnstile(page);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`/${locale}/prayer`);
    await waitForTurnstile(page);
    await page.locator('main form button[type="submit"]').click();
    await expect(page.getByTestId("form-alert")).toBeVisible();
    await expect(page.locator("#prayer-body-error")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("the open lightbox has no serious/critical axe violations", async ({
  page,
}) => {
  await page.goto("/en/missions/sample-past-gathering");
  await page.getByTestId("gallery-thumb").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("the media center with a loaded video has no serious/critical axe violations", async ({
  page,
}) => {
  await page.route(/youtube(-nocookie)?\.com|ytimg\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html lang='en'><head><title>stub</title></head><body></body></html>",
    }),
  );
  await page.goto("/en/media");
  await page
    .getByRole("button", { name: "Play video: E2E fixture video" })
    .click();
  await expect(page.locator("iframe")).toHaveCount(1);
  expect(await seriousViolations(page)).toEqual([]);
});

for (const locale of ["en", "ne"]) {
  for (const width of [1280, 375]) {
    test(`home /${locale} at ${width}px has no serious/critical axe violations`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test(`home /${locale} with the mobile menu open has no serious/critical axe violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/${locale}`);
    await page.locator('[data-testid="mobile-menu-trigger"]').click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
}

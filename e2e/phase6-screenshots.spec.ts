import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { OWNER_STATE } from "./helpers/admin";
import {
  stubTurnstile,
  uniqueMarker,
  waitForTurnstile,
} from "./helpers/turnstile";

const outDir = path.join(process.cwd(), ".agents", "screenshots", "phase6");

test.describe.configure({ mode: "serial" });

async function settle(page: Page, width: number) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => window.scrollTo(0, 0));
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

async function shot(page: Page, name: string, width: number, fullPage = true) {
  await settle(page, width);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage });
}

async function open(page: Page, url: string, width: number) {
  await stubTurnstile(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url);
  if (!url.startsWith("/admin")) await waitForTurnstile(page);
}

const SUBMIT = {
  prayer: { en: "Send prayer request", ne: "प्रार्थना अनुरोध पठाउनुहोस्" },
  contact: { en: "Send message", ne: "सन्देश पठाउनुहोस्" },
} as const;

// ---------- public forms ----------

for (const locale of ["en", "ne"] as const) {
  for (const width of [375, 1280]) {
    for (const form of ["prayer", "contact"] as const) {
      test(`screenshot ${form} ${locale} @ ${width}px`, async ({ page }) => {
        await open(page, `/${locale}/${form}`, width);
        await shot(page, `${form}-${locale}-${width}`, width);
      });
    }
  }

  for (const form of ["prayer", "contact"] as const) {
    test(`screenshot ${form} error ${locale} @ 375px`, async ({ page }) => {
      await open(page, `/${locale}/${form}`, 375);
      await page.getByRole("button", { name: SUBMIT[form][locale] }).click();
      await expect(page.getByTestId("form-alert")).toBeVisible();
      await shot(page, `${form}-error-${locale}-375`, 375);
    });
  }
}

test("screenshot prayer anonymous en @ 375px", async ({ page }) => {
  await open(page, "/en/prayer", 375);
  await page.getByLabel("Your name").fill("Typed name");
  await page.getByRole("checkbox", { name: "Send anonymously" }).check();
  await expect(page.getByLabel("Your name")).toBeDisabled();
  await page.getByLabel(/Your prayer request/).focus();
  await shot(page, "prayer-anonymous-en-375", 375);
});

for (const [locale, width] of [
  ["en", 1280],
  ["ne", 1280],
] as const) {
  test(`screenshot prayer success ${locale} @ ${width}px`, async ({ page }) => {
    await open(page, `/${locale}/prayer`, width);
    await page
      .getByLabel(
        locale === "en" ? /Your prayer request/ : /तपाईंको प्रार्थना अनुरोध/,
      )
      .fill(locale === "en" ? "Screenshot request." : "स्क्रिनसट अनुरोध।");
    await page.getByRole("button", { name: SUBMIT.prayer[locale] }).click();
    await expect(page.getByTestId("form-success")).toBeVisible();
    await shot(page, `prayer-success-${locale}-${width}`, width);
  });
}

test("screenshot contact testimony en @ 1280px", async ({ page }) => {
  await open(page, "/en/contact", 1280);
  await page.getByLabel("What is this about?").selectOption("TESTIMONY");
  await expect(
    page.getByRole("checkbox", { name: /share a shortened version/ }),
  ).toBeVisible();
  await shot(page, "contact-testimony-en-1280", 1280);
});

for (const [locale, width] of [
  ["en", 1280],
  ["ne", 375],
] as const) {
  test(`screenshot contact success ${locale} @ ${width}px`, async ({
    page,
  }) => {
    await open(page, `/${locale}/contact`, width);
    const ne = locale === "ne";
    await page
      .getByLabel(ne ? /तपाईंको नाम/ : /Your name/)
      .fill(ne ? "राम" : "Ram");
    await page
      .getByLabel(ne ? /तपाईंको इमेल/ : /Your email/)
      .fill("ram@example.org");
    await page.getByLabel(ne ? /^विषय/ : /Subject/).fill(uniqueMarker("shot"));
    await page
      .getByLabel(ne ? /^सन्देश/ : /^Message/)
      .fill(ne ? "नमस्ते" : "Hello");
    await page.getByRole("button", { name: SUBMIT.contact[locale] }).click();
    await expect(page.getByTestId("form-success")).toBeVisible();
    await shot(page, `contact-success-${locale}-${width}`, width);
  });
}

// ---------- admin inbox + prayer wall ----------

test.describe("admin and prayer wall", () => {
  let adminContext: BrowserContext;
  let admin: Page;
  const prayerName = uniqueMarker("Screenshot Person");
  const noConsentName = uniqueMarker("Private Person");
  const testimonySubject = uniqueMarker("Screenshot testimony");

  test.beforeAll(async ({ browser }) => {
    adminContext = await browser.newContext({ storageState: OWNER_STATE });
    admin = await adminContext.newPage();

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await stubTurnstile(page);
    // A consented prayer, a private one and a consented testimony.
    for (const [name, consent] of [
      [prayerName, true],
      [noConsentName, false],
    ] as const) {
      await page.goto("/en/prayer");
      await page.getByLabel("Your name").fill(name);
      await page
        .getByLabel(/Your prayer request/)
        .fill(
          "Please pray for my mother's recovery after her operation in Pokhara. She is 70.",
        );
      if (consent) {
        await page
          .getByRole("checkbox", { name: /share a shortened version/ })
          .check();
      }
      await waitForTurnstile(page);
      await page.getByRole("button", { name: "Send prayer request" }).click();
      await expect(page.getByTestId("form-success")).toBeVisible();
    }
    await page.goto("/en/contact");
    await page.getByLabel(/Your name/).fill("Screenshot Sender");
    await page.getByLabel(/Your email/).fill("sender@example.org");
    await page.getByLabel("What is this about?").selectOption("TESTIMONY");
    await page.getByLabel(/Subject/).fill(testimonySubject);
    await page
      .getByLabel(/^Message/)
      .fill("Last year our village received Bibles and a small group began.");
    await page
      .getByRole("checkbox", { name: /share a shortened version/ })
      .check();
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByTestId("form-success")).toBeVisible();
    await visitor.close();
  });

  test.afterAll(async () => {
    await adminContext?.close();
  });

  async function openPrayer(name: string) {
    await admin.goto(`/admin/inbox/prayer?q=${encodeURIComponent(name)}`);
    await admin.getByRole("link", { name, exact: true }).click();
    await expect(admin).toHaveURL(/\/admin\/inbox\/prayer\/[a-z0-9]+$/);
  }

  test("screenshot admin prayer detail with consent @ 1280 and 375", async () => {
    await openPrayer(prayerName);
    for (const width of [1280, 375]) {
      await admin.setViewportSize({ width, height: 900 });
      await admin.reload();
      await shot(admin, `admin-prayer-detail-consent-${width}`, width);
    }
  });

  test("screenshot admin prayer detail without consent @ 1280", async () => {
    await admin.setViewportSize({ width: 1280, height: 900 });
    await openPrayer(noConsentName);
    await shot(admin, "admin-prayer-detail-noconsent-1280", 1280);
  });

  test("publish a prayer and a testimony, then the admin message detail", async () => {
    await admin.setViewportSize({ width: 1280, height: 900 });
    await openPrayer(prayerName);
    await admin
      .getByLabel("Public text (English)")
      .fill(
        "Please pray for a mother recovering from an operation, and for her family.",
      );
    await admin
      .getByLabel("Public text (नेपाली, Nepali)")
      .fill(
        "शल्यक्रियापछि निको हुँदै गरेकी एक आमा र उहाँको परिवारका लागि प्रार्थना गर्नुहोस्।",
      );
    await admin.getByLabel(/I removed names, contact details/).check();
    await admin.getByRole("button", { name: "Publish public version" }).click();
    await expect(admin.getByTestId("toasts")).toContainText(
      "Public version published.",
    );

    await admin.goto(
      `/admin/inbox/messages?q=${encodeURIComponent(testimonySubject)}`,
    );
    await admin
      .getByRole("link", { name: testimonySubject, exact: true })
      .click();
    await admin
      .getByLabel("Public text (English)")
      .fill(
        "A village received Bibles last year, and a small group began to meet.",
      );
    await admin.getByLabel(/I removed names, contact details/).check();
    await admin.getByRole("button", { name: "Publish public version" }).click();
    await expect(admin.getByTestId("toasts")).toContainText(
      "Public version published.",
    );
    await admin.reload();
    await shot(admin, "admin-message-detail-testimony-1280", 1280);
  });

  test("screenshot admin prayer list @ 1280 and 375", async () => {
    for (const width of [1280, 375]) {
      await admin.setViewportSize({ width, height: 900 });
      await admin.goto("/admin/inbox/prayer");
      await shot(admin, `admin-prayer-list-${width}`, width);
    }
  });

  test("screenshot admin inbox settings @ 1280 and 375", async () => {
    for (const width of [1280, 375]) {
      await admin.setViewportSize({ width, height: 900 });
      await admin.goto("/admin/inbox/settings");
      await shot(admin, `admin-inbox-settings-${width}`, width);
    }
  });

  for (const [locale, width] of [
    ["en", 1280],
    ["ne", 375],
  ] as const) {
    test(`screenshot prayer wall ${locale} @ ${width}px`, async ({ page }) => {
      await open(page, `/${locale}/prayer`, width);
      await expect(page.getByTestId("prayer-wall")).toBeVisible();
      await shot(page, `prayer-wall-${locale}-${width}`, width);
    });
  }
});

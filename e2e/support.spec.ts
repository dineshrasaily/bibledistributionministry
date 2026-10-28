import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ne from "../messages/ne.json";

// The main E2E server has NO Stripe keys: the "not set up yet" state.

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  console.log(
    `[axe] ${page.url()} violations=${results.violations.length} serious/critical=${serious.length} passes=${results.passes.length}`,
  );
  return serious.map((v) => ({
    id: v.id,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

const locales = [
  { locale: "en", messages: en },
  { locale: "ne", messages: ne },
] as const;

for (const { locale, messages } of locales) {
  test(`/${locale}/support shows the not-configured state without keys`, async ({
    page,
  }) => {
    const res = await page.goto(`/${locale}/support`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.SupportPage.title,
    );
    const card = page.getByTestId("support-not-configured");
    await expect(
      card.getByRole("heading", {
        level: 2,
        name: messages.SupportPage.notConfiguredTitle,
      }),
    ).toBeVisible();
    // No form, no amounts, no tax wording.
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Continue to/ })).toHaveCount(
      0,
    );
    await expect(page.getByTestId("support-tax-note")).toHaveCount(0);
    await expect(page.getByText(/tax/i)).toHaveCount(0);
    // Contact email + other ways to help.
    await expect(
      card.getByRole("link", { name: "hello@example.org" }),
    ).toHaveAttribute("href", "mailto:hello@example.org");
    await card
      .getByRole("link", { name: messages.SupportPage.prayLink })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/prayer$`));
    await page.goto(`/${locale}/support`);
    await page
      .getByTestId("support-not-configured")
      .getByRole("link", { name: messages.SupportPage.contactLink })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/contact$`));
  });

  test(`/${locale}/support shows the demo "how gifts are used" text`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/support`);
    const info = page.getByTestId("support-info");
    await expect(info).toContainText(messages.SupportPage.demoGivingInfo);
    await expect(info.locator("[data-demo-badge]")).toBeVisible();
  });

  test(`/${locale} thank-you and cancelled pages render and are noindex`, async ({
    page,
  }) => {
    for (const [path, title] of [
      [
        "/support/thank-you?session_id=cs_test_anything",
        messages.SupportThanks.title,
      ],
      ["/support/cancelled", messages.SupportCancelled.title],
    ] as const) {
      const res = await page.goto(`/${locale}${path}`);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
    }
    // The thank-you page never echoes the session id.
    await page.goto(
      `/${locale}/support/thank-you?session_id=cs_test_secret_123`,
    );
    await expect(page.locator("body")).not.toContainText("cs_test_secret_123");
  });
}

test("the webhook says not configured without keys and only accepts POST", async ({
  request,
}) => {
  const post = await request.post("/api/stripe/webhook", {
    headers: {
      "content-type": "application/json",
      "stripe-signature": "t=1,v1=0",
    },
    data: "{}",
  });
  expect(post.status()).toBe(503);
  expect(await post.json()).toEqual({ error: "NOT_CONFIGURED" });
  expect(post.headers()["cache-control"]).toContain("no-store");
  expect(post.headers()["x-robots-tag"]).toContain("noindex");
  const get = await request.get("/api/stripe/webhook", { maxRedirects: 0 });
  expect(get.status()).toBe(405);
});

test("the sitemap lists /support but not the result pages", async ({
  request,
}) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/en/support");
  expect(xml).not.toContain("thank-you");
  expect(xml).not.toContain("cancelled");
});

test("the header is unchanged on the Support page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en/support");
  const header = page.locator("header").first();
  await expect(header.locator("a").first()).toContainText("Demo Ministry");
  await expect(
    header.getByRole("link", { name: en.Header.supportCta }),
  ).toHaveAttribute("href", "/en/support");
});

for (const width of [1280, 375]) {
  for (const { locale } of locales) {
    test(`support pages (${locale}) at ${width}px have no serious/critical axe violations`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/support",
        "/support/thank-you",
        "/support/cancelled",
      ]) {
        await page.goto(`/${locale}${path}`);
        await page.evaluate(() => document.fonts.ready);
        expect(await seriousViolations(page), path).toEqual([]);
      }
    });
  }
}

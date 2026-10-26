import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ne from "../messages/ne.json";

const locales = [
  { locale: "en", messages: en },
  { locale: "ne", messages: ne },
] as const;

test("/ redirects to /en", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

for (const { locale, messages } of locales) {
  test(`/${locale} home renders the three CTAs with <html lang=${locale}>`, async ({
    page,
  }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);

    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
      "Demo Ministry",
    );
    for (const name of [
      messages.Home.ctaLearnMore,
      messages.Home.ctaPrayer,
      messages.Home.ctaSupport,
    ]) {
      await expect(hero.getByRole("link", { name, exact: true })).toBeVisible();
    }

    await expect(page.locator("[data-demo-banner]")).toHaveText(
      messages.DemoBanner.text,
    );
    await expect(
      page.getByText("Isaiah 6:8 (WEB)", { exact: true }),
    ).toBeVisible();
  });

  test(`/${locale} unknown path shows the localized 404`, async ({ page }) => {
    const response = await page.goto(`/${locale}/does-not-exist`);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.NotFound.title,
    );
  });
}

test("sitemap.xml and robots.txt are served", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("/en/about");
  expect(xml).toContain("/ne/about");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("sitemap.xml");
});

test("home exposes hreflang alternates and Open Graph tags", async ({
  page,
}) => {
  await page.goto("/ne/about");
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute("href", /\/en\/about$/);
  await expect(
    page.locator('link[rel="alternate"][hreflang="ne"]'),
  ).toHaveAttribute("href", /\/ne\/about$/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "ne_NP",
  );
  await expect(page).toHaveTitle(/Demo Ministry/);
});

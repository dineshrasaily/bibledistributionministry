import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ne from "../messages/ne.json";

const PAGES = [
  "/about",
  "/devotionals",
  "/devotionals/sample-devotional-here-i-am",
  "/missions",
  "/missions/sample-past-gathering",
  "/media",
  "/privacy",
  "/terms",
];

const locales = [
  { locale: "en", messages: en },
  { locale: "ne", messages: ne },
] as const;

for (const { locale, messages } of locales) {
  test(`Phase 3 pages render in ${locale} with one h1 and lang=${locale}`, async ({
    page,
  }) => {
    for (const path of PAGES) {
      const url = `/${locale}${path}`;
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(200);
      await expect(page.locator("html"), url).toHaveAttribute("lang", locale);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1, url).toHaveCount(1);
      await expect(h1, url).toBeVisible();
      await expect(page.getByText(messages.NotFound.title)).toHaveCount(0);
    }
  });

  test(`drafts and unknown slugs are 404 in ${locale}`, async ({ page }) => {
    for (const path of [
      "/devotionals/e2e-draft-post",
      "/devotionals/does-not-exist",
      "/missions/does-not-exist",
      "/devotionals/Bad_Slug",
    ]) {
      const response = await page.goto(`/${locale}${path}`);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        messages.NotFound.title,
      );
    }
  });

  test(`privacy and terms show the template notice in ${locale}`, async ({
    page,
  }) => {
    for (const path of ["/privacy", "/terms"]) {
      await page.goto(`/${locale}${path}`);
      await expect(page.getByTestId("template-notice")).toContainText(
        messages.Legal.templateNotice,
      );
    }
  });

  test(`about shows the demo fallbacks with a demo badge in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/about`);
    const testimony = page.getByTestId("about-testimony");
    await expect(testimony).toContainText(messages.About.demo.testimony);
    await expect(testimony.locator("[data-demo-badge]")).toBeVisible();
    await expect(page.getByTestId("about-story")).toBeVisible();
    await expect(page.getByTestId("about-mission")).toBeVisible();
  });
}

test("detail pages expose hreflang alternates and article Open Graph tags", async ({
  page,
}) => {
  await page.goto("/ne/devotionals/sample-devotional-here-i-am");
  await expect(
    page.locator('link[rel="alternate"][hreflang="en"]'),
  ).toHaveAttribute("href", /\/en\/devotionals\/sample-devotional-here-i-am$/);
  await expect(
    page.locator('link[rel="alternate"][hreflang="ne"]'),
  ).toHaveAttribute("href", /\/ne\/devotionals\/sample-devotional-here-i-am$/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/ne\/devotionals\/sample-devotional-here-i-am$/,
  );

  await page.goto("/en/missions/sample-past-gathering");
  await expect(
    page.locator('link[rel="alternate"][hreflang="ne"]'),
  ).toHaveAttribute("href", /\/ne\/missions\/sample-past-gathering$/);
  await expect(page).toHaveTitle(/Sample past gathering/);
});

test("sitemap lists published detail pages and never drafts", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml).toContain("/en/devotionals/sample-devotional-here-i-am");
  expect(xml).toContain("/ne/missions/sample-past-gathering");
  expect(xml).not.toContain("e2e-draft-post");
  expect(xml).not.toContain("/admin");
});

// The privacy policy says the only visitor cookie is next-intl's
// session-only language preference. Keep the two in sync.
test("the only visitor cookie is the session language preference", async ({
  page,
  context,
}) => {
  for (const path of ["/en", "/ne/about", "/en/devotionals?q=x", "/ne/media"]) {
    await page.goto(path);
  }
  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).toEqual(["NEXT_LOCALE"]);
  expect(cookies[0]!.value).toMatch(/^(en|ne)$/);
  expect(cookies[0]!.expires).toBe(-1); // session cookie
});

test("home cards link to the new detail pages", async ({ page }) => {
  await page.goto("/en");
  await expect(
    page.locator('a[href="/en/devotionals/sample-devotional-here-i-am"]'),
  ).not.toHaveCount(0);
  await expect(
    page.locator('a[href="/en/missions/sample-mission-trip"]'),
  ).not.toHaveCount(0);
  await expect(page.locator('a[href^="/en/media#media-"]')).not.toHaveCount(0);
});

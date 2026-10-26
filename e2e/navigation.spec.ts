import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ne from "../messages/ne.json";

const routes = [
  "/",
  "/about",
  "/devotionals",
  "/missions",
  "/media",
  "/prayer",
  "/support",
  "/contact",
  "/privacy",
  "/terms",
];

const localized = (locale: string, route: string) =>
  route === "/" ? `/${locale}` : `/${locale}${route}`;

for (const locale of ["en", "ne"] as const) {
  test(`every route resolves in ${locale}`, async ({ page }) => {
    for (const route of routes) {
      const url = localized(locale, route);
      const response = await page.goto(url);
      expect(response?.status(), url).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
}

const navCases = [
  { locale: "en", messages: en },
  { locale: "ne", messages: ne },
] as const;

for (const { locale, messages } of navCases) {
  test(`desktop nav links navigate without 404 (${locale})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${locale}`);
    const nav = page
      .getByRole("banner")
      .getByRole("navigation", { name: messages.Header.mainNavLabel });

    const items = [
      ["home", "/"],
      ["devotionals", "/devotionals"],
      ["missions", "/missions"],
      ["media", "/media"],
      ["prayer", "/prayer"],
    ] as const;

    // About, Support and Contact are intentionally not in the header nav.
    for (const key of ["about", "support", "contact"] as const) {
      await expect(
        nav.getByRole("link", { name: messages.Nav[key], exact: true }),
      ).toHaveCount(0);
    }

    for (const [key, route] of items) {
      await nav
        .getByRole("link", { name: messages.Nav[key], exact: true })
        .click();
      const expected = localized(locale, route);
      await expect(page).toHaveURL(new RegExp(`${expected}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(messages.NotFound.title)).toHaveCount(0);
    }
  });

  test(`footer still links About, Support, Contact (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const footer = page.getByRole("contentinfo");
    for (const key of ["about", "support", "contact"] as const) {
      await expect(
        footer.getByRole("link", { name: messages.Nav[key], exact: true }),
      ).toBeVisible();
    }
  });

  test(`footer legal links resolve (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const footer = page.getByRole("contentinfo");
    for (const key of ["privacy", "terms"] as const) {
      await footer
        .getByRole("link", { name: messages.Nav[key], exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/${key}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
}

import { expect, test, type Page } from "@playwright/test";

const cases = [
  { from: "/en/about", target: "नेपाली", to: "/ne/about", lang: "ne" },
  { from: "/ne/missions", target: "English", to: "/en/missions", lang: "en" },
  { from: "/en", target: "नेपाली", to: "/ne", lang: "ne" },
] as const;

async function switcherIn(page: Page, mobile: boolean) {
  if (!mobile) {
    return page
      .getByRole("banner")
      .getByRole("navigation", { name: /Language|भाषा/ });
  }
  await page.getByRole("button", { name: /Open menu|मेनु खोल्नुहोस्/ }).click();
  return page
    .getByRole("dialog")
    .getByRole("navigation", { name: /Language|भाषा/ });
}

for (const width of [1280, 375]) {
  test.describe(`language switcher at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const c of cases) {
      test(`${c.from} -> ${c.to}`, async ({ page }) => {
        await page.goto(c.from);
        const switcher = await switcherIn(page, width < 1280);
        const link = switcher.getByRole("link", {
          name: c.target,
          exact: true,
        });
        await expect(link).toHaveAttribute("href", c.to);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${c.to}$`));
        await expect(page.locator("html")).toHaveAttribute("lang", c.lang);
      });
    }
  });
}

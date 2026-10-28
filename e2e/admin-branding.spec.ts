import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./helpers/admin";
import { LOGO_MARK as LOGO, setLogo } from "./helpers/branding";

/** Phase 9: the logo from Settings shows in the footer, login and admin. */

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setLogo(page, LOGO);
  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: OWNER_STATE });
  await setLogo(page, "");
  await page.close();
});

for (const locale of ["en", "ne"]) {
  test(`the /${locale} footer shows the logo`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const logo = page.locator(`footer img[src="${LOGO}"]`);
    await logo.scrollIntoViewIfNeeded();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("alt", "");
    const box = await logo.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    // Not squashed: the 241x112 mark keeps its aspect ratio.
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeGreaterThan(1.8);
  });
}

test("the admin login page shows the logo (signed out)", async ({
  browser,
}) => {
  // test.use({ storageState }) also applies to browser.newContext(): sign out
  // explicitly.
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeVisible();
  const logo = page.locator(`main img[src="${LOGO}"]`);
  await expect(logo).toBeVisible();
  expect((await logo.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await context.close();
});

test("the admin sidebar shows the logo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin");
  await expect(
    page.getByRole("complementary").locator(`img[src="${LOGO}"]`),
  ).toBeVisible();
});

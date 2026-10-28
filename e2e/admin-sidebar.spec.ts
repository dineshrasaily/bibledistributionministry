import { expect, test, type Page } from "@playwright/test";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";

/**
 * Phase 9 (review NIT): Log out is pinned at the bottom of the admin sidebar,
 * reachable without scrolling on short laptop screens. Never clicks Log out:
 * logging out revokes the shared storage states (admin-logout.spec.ts uses
 * its own user).
 */

const sidebar = (page: Page) => page.getByRole("complementary");
const logout = (page: Page) =>
  sidebar(page).getByRole("button", { name: "Log out" });

async function expectLogoutPinned(page: Page) {
  await expect(logout(page)).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
}

for (const [who, state, paths] of [
  ["owner", OWNER_STATE, ["/admin", "/admin/settings"]],
  ["editor", EDITOR_STATE, ["/admin"]],
] as const) {
  test.describe(`as the ${who}`, () => {
    test.use({ storageState: state });
    for (const height of [650, 600]) {
      for (const path of paths) {
        test(`${path} at 1280x${height}: Log out is visible without scrolling`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: 1280, height });
          await page.goto(path);
          await expectLogoutPinned(page);
        });
      }
    }
  });
}

test.describe("scrolling and keyboard (owner)", () => {
  test.use({ storageState: OWNER_STATE });

  test("the nav scrolls inside the sidebar; Log out stays put", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 650 });
    await page.goto("/admin");
    const region = page.getByTestId("admin-sidebar-scroll");
    const { scrollHeight, clientHeight } = await region.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    await region.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const account = sidebar(page)
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Account" });
    await expect(account).toBeInViewport({ ratio: 1 });
    await expectLogoutPinned(page);
  });

  test("Tab from the last nav link (Account) reaches Log out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 650 });
    await page.goto("/admin");
    await sidebar(page)
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Account" })
      .focus();
    await page.keyboard.press("Tab");
    await expect(logout(page)).toBeFocused();
    await expect(logout(page)).toBeInViewport({ ratio: 1 });
  });

  test("the mobile admin menu shows Log out without scrolling (375x650)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 650 });
    await page.goto("/admin");
    await page.getByTestId("admin-menu-trigger").click();
    const dialog = page.getByRole("dialog", { name: "Admin menu" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Log out" }),
    ).toBeInViewport({ ratio: 1 });
  });
});

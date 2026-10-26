import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("mobile menu opens, traps focus and closes by keyboard", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  // While the modal is open the rest of the page is aria-hidden, so use the
  // test id (not the role) to keep a handle on the trigger.
  const trigger = page.locator('[data-testid="mobile-menu-trigger"]');
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

  // Skip link is the first focusable element.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();

  // The trigger is reachable in tab order.
  for (let i = 0; i < 10; i++) {
    if (await trigger.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(trigger).toBeFocused();

  // Enter opens.
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  // Focus stays inside the dialog while tabbing.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    );
    expect(inside).toBe(true);
  }

  // Escape closes and returns focus.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  // Space re-opens; the close button closes with Enter.
  await page.keyboard.press("Space");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close menu" });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("selecting a menu link by keyboard navigates and closes the menu", async ({
  page,
}) => {
  await page.goto("/en");
  const trigger = page.getByRole("button", { name: "Open menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();

  const missions = dialog.getByRole("link", { name: "Missions", exact: true });
  await missions.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/missions$/);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Missions");
});

for (const locale of ["en", "ne"]) {
  test(`no horizontal overflow at 375px (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
}

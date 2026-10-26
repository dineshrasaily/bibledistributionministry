import { expect, test } from "@playwright/test";
import { e2eUser, loginAs } from "./helpers/admin";

// Uses editor2 only: logout bumps sessionVersion, which would invalidate the
// shared owner/editor storage states.
test("logging out ends the session; /admin then redirects to login (AC22)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAs(page, e2eUser("editor2"));
  await expect(
    page.getByTestId("session-indicator").locator("visible=true"),
  ).toContainText("E2E Editor 2");

  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("button", { name: "Log out" })
    .click();
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in" }),
  ).toBeVisible();
});

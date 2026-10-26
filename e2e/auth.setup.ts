import { expect, test as setup } from "@playwright/test";
import { e2eUser, EDITOR_STATE, loginAs, OWNER_STATE } from "./helpers/admin";

// AC13: full login with password + TOTP lands on the dashboard with name + role.
setup.describe.configure({ timeout: 90_000 });

setup(
  "owner signs in with password and authenticator code",
  async ({ page }) => {
    const owner = e2eUser("owner");
    await loginAs(page, owner);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    const indicator = page
      .getByTestId("session-indicator")
      .locator("visible=true");
    await expect(indicator).toContainText("E2E Owner");
    await expect(indicator).toContainText("Owner");
    await page.context().storageState({ path: OWNER_STATE });
  },
);

setup(
  "editor signs in with password and authenticator code",
  async ({ page }) => {
    const editor = e2eUser("editor");
    await loginAs(page, editor);
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    const indicator = page
      .getByTestId("session-indicator")
      .locator("visible=true");
    await expect(indicator).toContainText("E2E Editor");
    await expect(indicator).toContainText("Editor");
    await page.context().storageState({ path: EDITOR_STATE });
  },
);

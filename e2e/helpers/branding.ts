import { expect, type Page } from "@playwright/test";

export const LOGO_MARK = "/brand/logo-mark.png";

/** Saves Settings › Logo picture (owner page). `""` removes the logo. */
export async function setLogo(page: Page, url: string): Promise<void> {
  await page.goto("/admin/settings");
  await page.getByLabel("Logo picture (optional)", { exact: true }).fill(url);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("toasts")).toContainText("Settings saved.");
}

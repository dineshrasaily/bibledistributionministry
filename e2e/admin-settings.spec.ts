import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./helpers/admin";

test.use({ storageState: OWNER_STATE });

async function setMinistryName(page: Page, name: string) {
  await page.goto("/admin/settings");
  const field = page.getByLabel(/^Ministry name/);
  await field.fill(name);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("toasts")).toContainText("Settings saved.");
}

function headerBrand(page: Page) {
  // Brand link (logo + name) at the start of the public header.
  return page.locator("header").first().locator("a").first();
}

test("changing the ministry name updates the public header (AC10)", async ({
  page,
}) => {
  try {
    await setMinistryName(page, "E2E Ministry");
    await page.goto("/en");
    await expect(headerBrand(page)).toContainText("E2E Ministry");
  } finally {
    await setMinistryName(page, "Demo Ministry");
  }
  await page.goto("/en");
  await expect(headerBrand(page)).toContainText("Demo Ministry");
});

async function setTestimony(page: Page, text: string) {
  await page.goto("/admin/settings");
  await page
    .getByLabel("Testimony / faith journey (English)", { exact: true })
    .fill(text);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("toasts")).toContainText("Settings saved.");
}

test("the About testimony saved in Settings replaces the sample text", async ({
  page,
}) => {
  try {
    await setTestimony(page, "E2E testimony text");
    await page.goto("/en/about");
    const section = page.getByTestId("about-testimony");
    await expect(section).toContainText("E2E testimony text");
    await expect(section.locator("[data-demo-badge]")).toHaveCount(0);
    // Nepali pages fall back to the English text, marked lang="en".
    await page.goto("/ne/about");
    await expect(
      page.getByTestId("about-testimony").locator('[lang="en"]'),
    ).toContainText("E2E testimony text");
  } finally {
    await setTestimony(page, "");
  }
  await page.goto("/en/about");
  await expect(page.getByTestId("about-testimony")).toContainText(
    "Sample text:",
  );
});

test("an About photo without a description is a field error", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await page
    .getByLabel("Photo (optional)", { exact: true })
    .fill("/brand/logo-full.png");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("form-error-summary")).toBeVisible();
  await expect(
    page.getByLabel("Photo description (English)", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
});

test("an invalid social link is rejected with a field error", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await page.getByLabel("Facebook").fill("http://facebook.com/demo");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("form-error-summary")).toBeVisible();
  await expect(page.getByLabel("Facebook")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

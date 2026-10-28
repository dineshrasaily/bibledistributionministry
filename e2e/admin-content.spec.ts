import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./helpers/admin";

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const publishedTitle = `E2E published update ${stamp}`;
const draftTitle = `E2E draft update ${stamp}`;

async function fillNewUpdate(page: Page, title: string) {
  await page.goto("/admin/posts/new");
  await page.getByLabel(/^Type/).selectOption("MINISTRY_UPDATE");
  await page.getByLabel(/Title \(English\)/).fill(title);
  // The slug follows the English title.
  await expect(page.getByLabel(/URL slug/)).toHaveValue(
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  );
  await page
    .getByLabel(/Short summary \(English\)/)
    .fill(`Summary for ${title}.`);
}

function recentUpdates(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("heading", { name: "Recent ministry updates" }),
  });
}

test("publishing a ministry update shows it on /en (AC9)", async ({ page }) => {
  await fillNewUpdate(page, publishedTitle);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
  await expect(page.getByTestId("toasts")).toContainText("Created.");
  // A published record shows Update + Unpublish, never Save draft.
  await expect(page.getByRole("button", { name: "Update" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toHaveCount(0);

  await page.goto("/en");
  await expect(
    recentUpdates(page).getByRole("heading", { name: publishedTitle }),
  ).toBeVisible();
});

test("a draft never appears on /en or /ne (AC7)", async ({ page }) => {
  await fillNewUpdate(page, draftTitle);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();

  for (const locale of ["en", "ne"]) {
    await page.goto(`/${locale}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText(draftTitle)).toHaveCount(0);
  }
});

test("validation errors show a summary and keep the entered values", async ({
  page,
}) => {
  await page.goto("/admin/posts/new");
  await page.getByLabel(/Title \(नेपाली, Nepali\)/).fill("शीर्षक मात्र");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const summary = page.getByTestId("form-error-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link").first()).toBeVisible();
  await expect(page.getByLabel(/Title \(नेपाली, Nepali\)/)).toHaveValue(
    "शीर्षक मात्र",
  );
});

// Phase 7: rewritten. Photos are linked to events through a gallery now.
test("a photo in a gallery linked to an event appears on the event, then is gone", async ({
  page,
}) => {
  const photoTitle = `E2E linked photo ${stamp}`;
  await page.goto("/admin/media/new");
  await page.getByLabel(/^Media type/).selectOption("IMAGE");
  await page.getByLabel(/^Image link/).fill("/demo/gallery/sample-4.svg");
  await page
    .getByLabel(/Image description \(alt text\) \(English\)/)
    .fill("E2E sample placeholder");
  await page.getByLabel(/^Category/).selectOption("GALLERY");
  await page.getByLabel(/Title \(English\)/).fill(photoTitle);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/media\/(?!new\b)[a-z0-9]+/);
  await expect(page.getByTestId("toasts")).toContainText("Created.");

  await page.goto("/admin/galleries/new?eventId=event-1");
  await page
    .getByLabel(/Title \(English\)/)
    .fill(`E2E linked gallery ${stamp}`);
  await expect(page.getByLabel("Linked mission/event (optional)")).toHaveValue(
    "event-1",
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/galleries\/(?!new\b)[a-z0-9-]+/);
  await page.getByRole("button", { name: "Add pictures from library" }).click();
  const dialog = page.getByTestId("gallery-add-dialog");
  await dialog.getByLabel(photoTitle).check();
  await dialog.getByRole("button", { name: /^Add 1 selected/ }).click();
  await expect(page.getByTestId("toasts")).toContainText(
    "Pictures added to the gallery.",
  );
  await expect(page.getByTestId("gallery-item")).toHaveCount(1);

  await page.goto("/en/missions/sample-mission-trip");
  await expect(
    page.getByRole("button", { name: "Open photo: E2E sample placeholder" }),
  ).toBeVisible();

  await page.goto(
    `/admin/galleries?q=${encodeURIComponent(`E2E linked gallery ${stamp}`)}`,
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  // The dialog hides the page from the a11y tree while open: wait for it.
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: `E2E linked gallery ${stamp}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/en/missions/sample-mission-trip");
  await expect(
    page.getByRole("button", { name: "Open photo: E2E sample placeholder" }),
  ).toHaveCount(0);
});
test("unpublishing from the list removes the update from /en", async ({
  page,
}) => {
  await page.goto(`/admin/posts?q=${encodeURIComponent(publishedTitle)}`);
  await page
    .getByRole("button", { name: `Unpublish ${publishedTitle}` })
    .click();
  await expect(page.getByTestId("toasts")).toContainText("Post unpublished.");
  await page.goto("/en");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(publishedTitle)).toHaveCount(0);
});

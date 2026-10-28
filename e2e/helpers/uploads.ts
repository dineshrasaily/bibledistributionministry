import { expect, type Page } from "@playwright/test";

export type UploadSpec = {
  name: string;
  mimeType: string;
  buffer: Buffer;
  title: string;
  /** Pictures only. */
  alt?: string;
  publish?: boolean;
};

/** Opens the "Upload files" panel of the media library. */
export async function openUploadPanel(page: Page) {
  await page.goto("/admin/media");
  const panel = page.getByTestId("upload-panel");
  if (!(await panel.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await panel.getByText("Upload files", { exact: true }).click();
  }
  return panel;
}

/**
 * Uploads one file with the media library uploader (local driver in E2E)
 * and returns the stored URL from its library card.
 */
export async function uploadFromLibrary(
  page: Page,
  spec: UploadSpec,
): Promise<string> {
  const panel = await openUploadPanel(page);
  await panel.locator('input[type="file"]').setInputFiles({
    name: spec.name,
    mimeType: spec.mimeType,
    buffer: spec.buffer,
  });
  const card = panel
    .getByTestId("upload-card")
    .filter({ hasText: spec.name })
    .last();
  await card.getByLabel(/^Title/).fill(spec.title);
  if (spec.alt) {
    await card.getByLabel(/alt text\) \(English\)/).fill(spec.alt);
  }
  if (spec.publish) await card.getByLabel("Publish on the public site").check();
  await panel.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(card.getByText("Uploaded.")).toBeVisible({ timeout: 30_000 });
  return storedUrlOf(page, spec.title);
}

/** The stored URL of a library item, read from its editor's Stored file panel. */
export async function storedUrlOf(page: Page, title: string): Promise<string> {
  await page.goto(`/admin/media?q=${encodeURIComponent(title)}`);
  const card = page.getByTestId("media-card").filter({ hasText: title });
  await expect(card).toHaveCount(1);
  await card.getByRole("link", { name: title }).click();
  const code = page.getByTestId("stored-file").locator("code");
  await expect(code).toBeVisible();
  return (await code.textContent())!.trim();
}

/** Creates and publishes an ARTICLE, optionally choosing a library cover. Returns the slug. */
export async function publishArticle(
  page: Page,
  title: string,
  coverTitle?: string,
): Promise<{ slug: string; editorUrl: string }> {
  await page.goto("/admin/posts/new");
  await page.getByLabel(/^Type/).selectOption("ARTICLE");
  await page.getByLabel(/Title \(English\)/).fill(title);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  await expect(page.getByLabel(/URL slug/)).toHaveValue(slug);
  await page
    .getByLabel(/Short summary \(English\)/)
    .fill(`Summary for ${title}.`);
  if (coverTitle) await pickFromLibrary(page, "Cover picture", coverTitle);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/(?!new\b)[a-z0-9]+/);
  return { slug, editorUrl: page.url().replace(/\?.*$/, "") };
}

/** Opens a picker field's library dialog, searches and chooses a picture. */
export async function pickFromLibrary(
  page: Page,
  label: string,
  title: string,
) {
  await page
    .getByRole("button", {
      name: new RegExp(`^Choose from library:\\s*${escapeRe(label)}$`),
    })
    .click();
  const dialog = page.getByTestId("media-picker");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search pictures").fill(title);
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  await dialog
    .getByRole("button", {
      name: new RegExp(`^Use picture: ${escapeRe(title)}`),
    })
    .click();
  await expect(dialog).toHaveCount(0);
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

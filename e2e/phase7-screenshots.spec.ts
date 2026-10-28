import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PNG_320x240 } from "./fixtures/upload-files";
import { OWNER_STATE, scrollWidth } from "./helpers/admin";
import {
  openUploadPanel,
  pickFromLibrary,
  publishArticle,
} from "./helpers/uploads";

const DIR = path.join(process.cwd(), ".agents", "screenshots", "phase7");
mkdirSync(DIR, { recursive: true });

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const photoTitle = `Village visit ${stamp}`;
const photoAlt = "Navy and gold sample picture uploaded in the admin";
const photoAltNe = "एडमिनबाट अपलोड गरिएको गाढा नीलो र सुनौलो नमूना तस्बिर";
const postTitle = `Sample article with an uploaded cover ${stamp}`;
const galleryTitle = "Sample mission trip photos";
let postSlug = "";
let galleryUrl = "";

const SIZES = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
] as const;

async function shot(
  page: Page,
  name: string,
  width: number,
  target?: Locator,
  fullPage = false,
) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
  });
  await page.waitForLoadState("networkidle");
  expect(await scrollWidth(page)).toBeLessThanOrEqual(width);
  if (target) {
    await target.scrollIntoViewIfNeeded();
    await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
  }
  await page.screenshot({
    path: path.join(DIR, `${name}-${width}.png`),
    fullPage,
  });
}

test("setup: upload a picture, use it as a cover and in a gallery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const panel = await openUploadPanel(page);
  await panel.locator('input[type="file"]').setInputFiles({
    name: "village-visit.png",
    mimeType: "image/png",
    buffer: PNG_320x240,
  });
  const card = panel.getByTestId("upload-card");
  await card.getByLabel(/^Title/).fill(photoTitle);
  await card.getByLabel(/alt text\) \(English\)/).fill(photoAlt);
  await card.getByLabel(/alt text\) \(नेपाली/).fill(photoAltNe);
  await card.getByLabel("Publish on the public site").check();
  await shot(page, "admin-upload-selected", 1280, panel);
  await panel.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(card.getByText("Uploaded.")).toBeVisible({ timeout: 30_000 });
  await shot(page, "admin-upload-done", 1280, panel);

  const post = await publishArticle(page, postTitle, photoTitle);
  postSlug = post.slug;
  await page.goto(post.editorUrl);
  await expect(page.getByLabel("Cover picture", { exact: true })).toHaveValue(
    /\/api\/uploads\//,
  );
  await shot(
    page,
    "admin-post-cover-picked",
    1280,
    page.getByTestId("picker-coverImageUrl"),
  );

  await page.goto("/admin/galleries/new?eventId=event-1");
  await page.getByLabel(/Title \(English\)/).fill(galleryTitle);
  await page.getByLabel(/Title \(नेपाली/).fill("नमूना मिसन यात्राका तस्बिरहरू");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/galleries\/(?!new\b)[a-z0-9-]+/);
  galleryUrl = page.url().replace(/\?.*$/, "");
  await page.getByRole("button", { name: "Add pictures from library" }).click();
  const dialog = page.getByTestId("gallery-add-dialog");
  await dialog.getByLabel(photoTitle).check();
  await dialog.getByLabel("Sample placeholder photo 4").check();
  await dialog.getByRole("button", { name: /^Add 2 selected/ }).click();
  await expect(page.getByTestId("gallery-item")).toHaveCount(2);
});

for (const size of SIZES) {
  test(`admin screens @ ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/admin/media");
    await expect(page.getByTestId("media-grid")).toBeVisible();
    await shot(page, "admin-media-library", size.width, undefined, true);

    if (size.width === 375) {
      const panel = await openUploadPanel(page);
      await panel.locator('input[type="file"]').setInputFiles({
        name: "family-photo.png",
        mimeType: "image/png",
        buffer: PNG_320x240,
      });
      await expect(panel.getByTestId("upload-card")).toBeVisible();
      await shot(
        page,
        "admin-upload-selected",
        375,
        panel.getByTestId("upload-card"),
      );
    }

    await page.goto("/admin/posts/new");
    await page
      .getByRole("button", { name: /^Choose from library:\s*Cover picture$/ })
      .click();
    const picker = page.getByTestId("media-picker");
    await expect(
      picker.getByRole("button", { name: /^Use picture:/ }).first(),
    ).toBeVisible();
    await picker
      .getByRole("button", { name: /^Use picture:/ })
      .first()
      .focus();
    await shot(page, "admin-media-picker", size.width);
    await page.keyboard.press("Escape");

    await page.goto(galleryUrl);
    await expect(page.getByTestId("gallery-item")).toHaveCount(2);
    await shot(page, "admin-gallery-editor", size.width, undefined, true);

    if (size.width === 1280) {
      await page.goto("/admin/galleries");
      await shot(page, "admin-galleries", 1280, undefined, true);
      await page.goto(`/admin/media?q=${encodeURIComponent(photoTitle)}`);
      await page.getByRole("link", { name: photoTitle, exact: true }).click();
      await expect(page.getByTestId("stored-file")).toBeVisible();
      await shot(page, "admin-media-uploaded-editor", 1280, undefined, true);
      // Picker on the settings page (not saved).
      await page.goto("/admin/settings");
      await pickFromLibrary(page, "Logo picture (optional)", photoTitle);
      await page.reload();
    }
  });
}

for (const locale of ["en", "ne"] as const) {
  for (const size of SIZES) {
    test(`public pages with uploads (${locale}) @ ${size.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto(`/${locale}/devotionals/${postSlug}`);
      const cover = page.locator('main img[src*="/api/uploads/"]').first();
      await expect(cover).toBeVisible();
      await shot(
        page,
        `devotional-uploaded-cover-${locale}`,
        size.width,
        cover,
      );

      await page.goto(`/${locale}/missions/sample-mission-trip`);
      const thumbs = page.getByTestId("gallery-thumb");
      await expect(thumbs).toHaveCount(2);
      await shot(page, `mission-gallery-${locale}`, size.width, thumbs.first());

      await page.goto(`/${locale}/media`);
      const group = page.getByTestId("photo-group").first();
      await expect(group).toBeVisible();
      await shot(page, `media-galleries-${locale}`, size.width, group);

      if (locale === "en" && size.width === 1280) {
        await page.goto("/en");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: path.join(DIR, "header-unchanged-en-1280.png"),
        });
      }
    });
  }
}

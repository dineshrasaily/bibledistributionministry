import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  HTML_AS_PNG,
  JPEG_SMALL,
  MP3_LIKE,
  PNG_320x240,
  SVG_TEXT,
} from "./fixtures/upload-files";
import { OWNER_STATE } from "./helpers/admin";
import {
  escapeRe,
  openUploadPanel,
  pickFromLibrary,
  publishArticle,
  uploadFromLibrary,
} from "./helpers/uploads";

test.use({ storageState: OWNER_STATE });
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const coverTitle = `E2E cover ${stamp}`;
const coverAlt = `E2E uploaded photo ${stamp}`;
const postTitle = `E2E cover post ${stamp}`;
const galleryTitle = `E2E gallery ${stamp}`;
const galleryPhotoTitle = `E2E gallery photo ${stamp}`;
const galleryPhotoAlt = `E2E gallery alt ${stamp}`;
const audioTitle = `E2E talk ${stamp}`;

let coverUrl = "";
let postEditorUrl = "";
let postSlug = "";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  console.log(
    `[axe] ${page.url()} violations=${results.violations.length} serious/critical=${serious.length} passes=${results.passes.length}`,
  );
  return serious.map((v) => ({
    id: v.id,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

test("an admin uploads a picture (local driver) and uses it as a post cover", async ({
  page,
}) => {
  coverUrl = await uploadFromLibrary(page, {
    name: "e2e-photo.png",
    mimeType: "image/png",
    buffer: PNG_320x240,
    title: coverTitle,
    alt: coverAlt,
  });
  expect(coverUrl).toMatch(
    /^\/api\/uploads\/media\/images\/\d{4}\/\d{2}\/e2e-photo-[a-z0-9]{10}\.png$/,
  );
  // The editor shows the stored file panel instead of a link field.
  await expect(page.getByTestId("stored-file")).toContainText("image/png");
  await expect(page.getByLabel(/^Image link/)).toHaveCount(0);

  const file = await page.request.get(coverUrl);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/png");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");

  await page.goto(`/admin/media?q=${encodeURIComponent(coverTitle)}`);
  const card = page.getByTestId("media-card").filter({ hasText: coverTitle });
  await expect(card.getByTestId("media-source")).toContainText(
    "Image · Uploaded",
  );
  await expect(card.getByRole("img", { name: coverAlt })).toBeVisible();

  const post = await publishArticle(page, postTitle, coverTitle);
  postSlug = post.slug;
  postEditorUrl = post.editorUrl;
  await expect(page.getByLabel("Cover picture", { exact: true })).toHaveValue(
    coverUrl,
  );

  await page.goto(`/en/devotionals/${postSlug}`);
  const cover = page
    .locator(`main img[src*="/api/uploads/media/images/"]`)
    .first();
  await expect(cover).toBeVisible();
  expect(
    await cover.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  expect((await page.goto(`/ne/devotionals/${postSlug}`))!.status()).toBe(200);
});

test("drag and drop adds a file card with a preview", async ({ page }) => {
  const panel = await openUploadPanel(page);
  const dataTransfer = await page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "dropped.jpg", { type: "image/jpeg" }));
    return dt;
  }, JPEG_SMALL.toString("base64"));
  const zone = panel.getByTestId("drop-zone");
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await zone.dispatchEvent("drop", { dataTransfer });
  const card = panel
    .getByTestId("upload-card")
    .filter({ hasText: "dropped.jpg" });
  await expect(card).toBeVisible();
  await expect(card.locator('img[src^="blob:"]')).toBeVisible();
  await expect(card.getByLabel(/alt text\) \(English\)/)).toBeVisible();
});

test("unsupported files are refused in the browser and by the server", async ({
  page,
  baseURL,
}) => {
  const panel = await openUploadPanel(page);
  const uploads: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/admin/uploads/")) uploads.push(r.url());
  });
  await panel.locator('input[type="file"]').setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: SVG_TEXT,
  });
  await expect(panel.getByRole("alert")).toContainText(
    "Only JPEG, PNG and WebP",
  );
  expect(uploads).toEqual([]);

  const res = await page.request.post("/api/admin/uploads/local?kind=IMAGE", {
    headers: {
      Origin: baseURL!,
      "Content-Type": "image/png",
      "X-File-Name": "evil.png",
    },
    data: HTML_AS_PNG,
  });
  expect(res.status()).toBe(415);
});

test("a file in use can't be deleted; once unused, deleting removes the file", async ({
  page,
}) => {
  await page.goto(`/admin/media?q=${encodeURIComponent(coverTitle)}`);
  const card = page.getByTestId("media-card").filter({ hasText: coverTitle });
  await card.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByTestId("toasts")).toContainText(
    `cover of post "${postTitle}"`,
  );
  expect((await page.request.get(coverUrl)).status()).toBe(200);

  await page.goto(postEditorUrl);
  await page
    .getByRole("button", { name: /^Remove picture:\s*Cover picture$/ })
    .click();
  await expect(page.getByLabel("Cover picture", { exact: true })).toHaveValue(
    "",
  );
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByTestId("toasts")).toContainText(
    "Post saved and published.",
  );

  await page.goto(`/admin/media?q=${encodeURIComponent(coverTitle)}`);
  await page
    .getByTestId("media-card")
    .filter({ hasText: coverTitle })
    .getByRole("button", { name: "Delete" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByTestId("media-card").filter({ hasText: coverTitle }),
  ).toHaveCount(0);
  expect((await page.request.get(coverUrl)).status()).toBe(404);
});

test("galleries: add, order, publish, show on the mission page, delete", async ({
  page,
}) => {
  await uploadFromLibrary(page, {
    name: "gallery-photo.png",
    mimeType: "image/png",
    buffer: PNG_320x240,
    title: galleryPhotoTitle,
    alt: galleryPhotoAlt,
    publish: true,
  });

  await page.goto("/admin/galleries/new?eventId=event-1");
  await page.getByLabel(/Title \(English\)/).fill(galleryTitle);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/galleries\/(?!new\b)[a-z0-9-]+/);
  const galleryUrl = page.url().replace(/\?.*$/, "");

  await page.getByRole("button", { name: "Add pictures from library" }).click();
  const dialog = page.getByTestId("gallery-add-dialog");
  await dialog.getByLabel(galleryPhotoTitle).check();
  await dialog.getByLabel("Sample placeholder photo 4").check();
  await dialog.getByRole("button", { name: /^Add 2 selected/ }).click();
  const items = page.getByTestId("gallery-item");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText(galleryPhotoTitle);

  await page
    .getByRole("button", { name: "Move up: Sample placeholder photo 4" })
    .click();
  await expect(items.first()).toContainText("Sample placeholder photo 4");
  await expect(
    page.getByRole("button", { name: "Move up", exact: true }).first(),
  ).toBeDisabled();

  await page.goto("/en/missions/sample-mission-trip");
  const thumbs = page.getByTestId("gallery-thumb");
  await expect(thumbs).toHaveCount(2);
  await expect(thumbs.nth(0)).toHaveAccessibleName(
    /Sample placeholder image 4/,
  );
  await expect(thumbs.nth(1)).toHaveAccessibleName(
    `Open photo: ${galleryPhotoAlt}`,
  );
  await thumbs.nth(1).click();
  await expect(page.getByTestId("lightbox")).toBeVisible();
  await expect(
    page.getByTestId("lightbox").getByRole("img", { name: galleryPhotoAlt }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("lightbox")).toHaveCount(0);

  await page.goto("/en/media");
  const group = page
    .getByTestId("photo-group")
    .filter({ has: page.getByRole("heading", { name: galleryTitle }) });
  await expect(
    group.getByRole("link", {
      name: "From: Sample mission trip to a village community",
    }),
  ).toBeVisible();
  expect((await page.goto("/ne/media"))!.status()).toBe(200);

  await page.goto(galleryUrl);
  await page.getByRole("button", { name: "Delete gallery" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/admin\/galleries(\?|$)/);
  await page.goto("/en/missions/sample-mission-trip");
  await expect(page.getByTestId("gallery-thumb")).toHaveCount(0);
});

test("audio uploads show as audio with a player in the editor", async ({
  page,
}) => {
  await uploadFromLibrary(page, {
    name: "e2e-talk.mp3",
    mimeType: "audio/mpeg",
    buffer: MP3_LIKE,
    title: audioTitle,
  });
  await expect(page.locator("audio[controls]")).toHaveCount(1);
  await page.goto(`/admin/media?q=${encodeURIComponent(audioTitle)}`);
  await expect(
    page
      .getByTestId("media-card")
      .filter({ hasText: audioTitle })
      .getByTestId("media-source"),
  ).toContainText("Audio · Uploaded");
});

test("the logo picker fills the field (not saved, so the header never changes)", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  const logo = page.getByLabel("Logo picture (optional)", { exact: true });
  const before = await logo.inputValue();
  await pickFromLibrary(page, "Logo picture (optional)", galleryPhotoTitle);
  await expect(logo).toHaveValue(/^\/api\/uploads\/media\/images\//);
  await page.reload();
  await expect(
    page.getByLabel("Logo picture (optional)", { exact: true }),
  ).toHaveValue(before);
});

test("new admin pages have no serious/critical axe violations", async ({
  page,
}) => {
  const check = async () => expect(await seriousViolations(page)).toEqual([]);
  await page.goto("/admin/media");
  await check();

  const panel = await openUploadPanel(page);
  await panel.locator('input[type="file"]').setInputFiles({
    name: "axe-photo.png",
    mimeType: "image/png",
    buffer: PNG_320x240,
  });
  await expect(panel.getByTestId("upload-card")).toBeVisible();
  await check();

  await page.goto("/admin/posts/new");
  await page
    .getByRole("button", { name: /^Choose from library:\s*Cover picture$/ })
    .click();
  await expect(
    page
      .getByTestId("media-picker")
      .getByRole("button", { name: /^Use picture:/ })
      .first(),
  ).toBeVisible();
  await check();

  await page.goto("/admin/galleries");
  await check();
  await page.goto("/admin/galleries/gallery-event-4");
  await expect(page.getByTestId("gallery-item")).toHaveCount(3);
  await check();

  await page.goto(`/admin/media?q=${encodeURIComponent(galleryPhotoTitle)}`);
  await page
    .getByRole("link", { name: new RegExp(`^${escapeRe(galleryPhotoTitle)}$`) })
    .click();
  await expect(page.getByTestId("stored-file")).toBeVisible();
  await check();
});

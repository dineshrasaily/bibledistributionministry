import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";

const YOUTUBE = /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/;

/** Stubs every YouTube request and records them. */
async function stubYouTube(page: Page): Promise<string[]> {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (YOUTUBE.test(req.url())) requests.push(req.url());
  });
  await page.route(YOUTUBE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub</body></html>",
    }),
  );
  return requests;
}

test("no YouTube request or iframe until the visitor presses play", async ({
  page,
}) => {
  const requests = await stubYouTube(page);
  await page.goto("/en/media");
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);

  const play = page.getByRole("button", {
    name: "Play video: E2E fixture video",
  });
  await play.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);

  await play.click();
  const iframe = page.locator("iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute(
    "src",
    /^https:\/\/www\.youtube-nocookie\.com\/embed\/aaaaaaaaaaa\?autoplay=1$/,
  );
  await expect(iframe).toHaveAttribute("title", "E2E fixture video");
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(
    requests.every((u) => u.startsWith("https://www.youtube-nocookie.com/")),
  ).toBe(true);
});

test("media center shows sermons, videos and galleries only (no worship or audio)", async ({
  page,
}) => {
  await page.goto("/en/media");
  for (const key of ["sermons", "videos", "galleries"] as const) {
    await expect(
      page.getByRole("heading", { level: 2, name: en.MediaCenter[key] }),
    ).toBeVisible();
  }
  for (const name of ["Worship", "Podcasts and audio"]) {
    await expect(
      page.getByRole("heading", { level: 2, name, exact: true }),
    ).toHaveCount(0);
  }
  await expect(page.getByTestId("media-worship")).toHaveCount(0);
  await expect(page.getByTestId("media-audio")).toHaveCount(0);
  await expect(page.locator("audio")).toHaveCount(0);
  // The demo worship video now appears under Videos.
  await expect(
    page.getByTestId("media-videos").locator("#media-media-4"),
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("media-sermons")
      .getByText(en.MediaCenter.videoUnavailable),
  ).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "From: Sample past gathering" }),
  ).toHaveAttribute("href", "/en/missions/sample-past-gathering");
});

test("gallery lightbox opens from the media center", async ({ page }) => {
  await page.goto("/en/media");
  await page
    .getByTestId("media-galleries")
    .getByTestId("gallery-thumb")
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("lightbox-counter")).toHaveText("Photo 1 of 3");
  await page.getByRole("button", { name: en.Lightbox.close }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("home featured media links to its card on the media page", async ({
  page,
}) => {
  await page.goto("/en/media#media-media-1");
  await expect(page.locator("#media-media-1")).toBeVisible();
});

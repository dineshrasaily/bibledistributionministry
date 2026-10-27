import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";

const cards = (page: Page) => page.getByTestId("post-card");
const searchBox = (page: Page) =>
  page.getByRole("searchbox", { name: en.Devotionals.searchLabel });

test("search narrows the list and keeps q in the URL", async ({ page }) => {
  await page.goto("/en/devotionals");
  await searchBox(page).fill("shepherd");
  await page.getByRole("button", { name: en.Devotionals.apply }).click();
  await expect(page).toHaveURL(/[?&]q=shepherd/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(
    "Sample devotional: the Lord is my shepherd",
  );
  await expect(page.getByTestId("results-count")).toHaveText("1 result");
  await expect(searchBox(page)).toHaveValue("shepherd");
});

test("Nepali search finds the Psalm 23 devotional", async ({ page }) => {
  await page.goto(`/ne/devotionals?q=${encodeURIComponent("भजनसंग्रह")}`);
  await expect(cards(page)).not.toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "नमूना भक्ति चिन्तन: भजनसंग्रह २३ मा भरोसा",
    }),
  ).toBeVisible();
});

test("type filter shows only Bible studies", async ({ page }) => {
  await page.goto("/en/devotionals");
  await page
    .getByLabel(en.Devotionals.typeLabel)
    .selectOption({ label: en.PostTypes.BIBLE_STUDY });
  await page.getByRole("button", { name: en.Devotionals.apply }).click();
  await expect(page).toHaveURL(/type=BIBLE_STUDY/);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(
    "Sample Bible study: John chapter 3",
  );
});

test("category filter shows only posts in that category", async ({ page }) => {
  await page.goto("/en/devotionals");
  await page
    .getByLabel(en.Devotionals.categoryLabel)
    .selectOption({ label: "Scripture study" });
  await page.getByRole("button", { name: en.Devotionals.apply }).click();
  await expect(page).toHaveURL(/category=scripture-study/);
  await expect(cards(page)).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Sample Bible study: John chapter 3" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Sample update: a weekend of Scripture reading",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: en.Devotionals.clear }).click();
  await expect(page).toHaveURL(/\/en\/devotionals$/);
});

test("a search with no match shows the no-match empty state", async ({
  page,
}) => {
  await page.goto("/en/devotionals?q=zzzz-no-such-text");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText(en.Devotionals.noMatchTitle)).toBeVisible();
});

test("invalid params are ignored instead of erroring", async ({ page }) => {
  const response = await page.goto(
    "/en/devotionals?type=NOPE&category=Bad%20Slug&page=-4",
  );
  expect(response?.status()).toBe(200);
  await expect(cards(page)).toHaveCount(9);
});

test("pagination: 9 per page, Next/Previous keep working", async ({ page }) => {
  await page.goto("/en/devotionals");
  await expect(cards(page)).toHaveCount(9);
  const nav = page.getByRole("navigation", { name: en.Pagination.label });
  await expect(nav.getByText(en.Pagination.previous)).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(
    nav.getByRole("link", { name: "1", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: en.Pagination.next }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(cards(page)).toHaveCount(3);
  await expect(nav.getByText("Page 2 of 2")).toBeVisible();
  await nav.getByRole("link", { name: en.Pagination.previous }).click();
  await expect(page).toHaveURL(/\/en\/devotionals$/);
});

test("detail page shows scripture, Markdown body and share links", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/en/devotionals/sample-devotional-here-i-am");
  const panel = page.getByTestId("scripture-panel");
  await expect(panel).toContainText("Isaiah 6:8 (WEB)");
  await expect(panel).toContainText("Here I am. Send me!");
  await expect(
    page.getByRole("heading", { level: 2, name: "A willing answer" }),
  ).toBeVisible();

  // The absolute canonical URL (metadataBase + path) is what gets shared.
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(canonical).toMatch(/\/en\/devotionals\/sample-devotional-here-i-am$/);
  const pageUrl = encodeURIComponent(canonical!);
  const share = page.getByTestId("share-buttons");
  for (const [name, host] of [
    [en.Share.facebook, "https://www.facebook.com/sharer/sharer.php?u="],
    [en.Share.x, "https://x.com/intent/post?url="],
    [en.Share.whatsapp, "https://wa.me/?text="],
  ] as const) {
    const link = share.getByRole("link", { name: new RegExp(`^${name}`) });
    await expect(link).toHaveAttribute(
      "href",
      new RegExp(`^${reEscape(host)}`),
    );
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(
    share.getByRole("link", { name: en.Share.facebook, exact: false }),
  ).toHaveAttribute("href", new RegExp(reEscape(pageUrl)));
  await expect(
    share.getByRole("link", { name: en.Share.email }),
  ).toHaveAttribute(
    "href",
    new RegExp(`^mailto:\\?subject=.*${reEscape(pageUrl)}`),
  );

  await share.getByRole("button", { name: en.Share.copyLink }).click();
  await expect(share.getByRole("status")).toHaveText(en.Share.copied);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    canonical,
  );
});

test("category badges on a post link back to the filtered list", async ({
  page,
}) => {
  await page.goto("/en/devotionals/sample-bible-study-john-3");
  await page.getByRole("link", { name: "Scripture study" }).click();
  await expect(page).toHaveURL(/category=scripture-study/);
  await expect(cards(page)).toHaveCount(2);
});

test("Nepali detail page notes that the verse text is English", async ({
  page,
}) => {
  await page.goto("/ne/devotionals/sample-devotional-here-i-am");
  const panel = page.getByTestId("scripture-panel");
  await expect(panel.locator('blockquote[lang="en"]')).toBeVisible();
  await expect(panel).toContainText("नेपाली अनुवाद पछि थपिनेछ");
});

test("unsafe Markdown is neutralised on the detail page", async ({ page }) => {
  await page.goto("/en/devotionals/e2e-markdown-safety");
  const article = page.getByTestId("post-detail");
  await expect(article.locator("strong", { hasText: "bold" })).toBeVisible();
  expect(await article.locator("script").count()).toBe(0);
  expect(await article.locator('a[href^="javascript:"]').count()).toBe(0);
  expect(await article.locator("img[onerror]").count()).toBe(0);
  expect(
    await page.evaluate(() => (window as { __xss?: number }).__xss),
  ).toBeUndefined();
});

function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

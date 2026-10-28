import { expect, test, type Browser, type Page } from "@playwright/test";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";
import {
  collectConsoleErrors,
  collectCspViolations,
  cspViolations,
  seriousViolations,
} from "./helpers/axe";

/**
 * Phase 9: axe (no serious/critical), no CSP violations and no console
 * errors on every admin page. Runs after the inbox specs so the inbox has
 * rows to open.
 */

test.describe.configure({ mode: "serial", timeout: 180_000 });

async function newPage(browser: Browser, storageState?: string) {
  // Signed out = an explicitly empty storage state.
  const context = await browser.newContext({
    storageState: storageState ?? { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await collectCspViolations(page);
  const errors = collectConsoleErrors(page, {
    ignore: [/status of 404/],
  });
  return { page, errors, context };
}

async function check(page: Page, errors: string[], label: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(await seriousViolations(page, label), label).toEqual([]);
  expect(await cspViolations(page), label).toEqual([]);
  expect(errors, label).toEqual([]);
}

/** The first `/admin/<section>/<id>` link on a list page (not /new). */
async function firstDetailHref(page: Page, section: string): Promise<string> {
  await page.goto(`/admin/${section}`);
  // Lists stream in (Suspense): wait for the first row link.
  const rows = page.locator(
    `main a[href^="/admin/${section}/"]:not([href$="/new"])`,
  );
  await expect(rows.first(), `a ${section} row to open`).toBeVisible();
  const hrefs = await rows.evaluateAll((els) =>
    els.map((e) => e.getAttribute("href") ?? ""),
  );
  const re = new RegExp(`^/admin/${section}/(?!new$)[^/?#]+$`);
  const href = hrefs.find((h) => re.test(h));
  expect(href, `a ${section} row to open`).toBeTruthy();
  return href!;
}

const LIST_PAGES = [
  "/admin",
  "/admin/posts",
  "/admin/categories",
  "/admin/verses",
  "/admin/events",
  "/admin/media",
  "/admin/galleries",
  "/admin/inbox/prayer",
  "/admin/inbox/messages",
  "/admin/inbox/settings",
  "/admin/settings",
  "/admin/donations",
  "/admin/users",
  "/admin/audit",
  "/admin/account",
];
const NEW_PAGES = [
  "/admin/posts/new",
  "/admin/verses/new",
  "/admin/events/new",
  "/admin/media/new",
  "/admin/galleries/new",
];
const DETAIL_SECTIONS = [
  "posts",
  "categories",
  "verses",
  "events",
  "media",
  "galleries",
  "inbox/prayer",
  "inbox/messages",
];

test("admin login (signed out) at 1280 and 375", async ({ browser }) => {
  const { page, errors, context } = await newPage(browser);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/login");
    await check(page, errors, `login ${width}`);
  }
  await context.close();
});

test("owner: every list page at 1280 and 375", async ({ browser }) => {
  const { page, errors, context } = await newPage(browser, OWNER_STATE);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of LIST_PAGES) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await check(page, errors, `${path} ${width}`);
    }
  }
  await context.close();
});

test("owner: every new/edit/detail page at 1280", async ({ browser }) => {
  const { page, errors, context } = await newPage(browser, OWNER_STATE);
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const path of NEW_PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await check(page, errors, path);
  }
  for (const section of DETAIL_SECTIONS) {
    const href = await firstDetailHref(page, section);
    const res = await page.goto(href);
    expect(res?.status(), href).toBe(200);
    await check(page, errors, href);
  }
  const res = await page.goto("/admin/does-not-exist");
  expect(res?.status()).toBe(404);
  await check(page, errors, "admin 404");
  await context.close();
});

test("owner: open dialogs (media picker, delete confirm, mobile menu)", async ({
  browser,
}) => {
  const { page, errors, context } = await newPage(browser, OWNER_STATE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/posts/new");
  await page
    .getByRole("button", { name: /^Choose from library:/ })
    .first()
    .click();
  await expect(page.getByTestId("media-picker")).toBeVisible();
  await check(page, errors, "media picker");
  await page.keyboard.press("Escape");

  await page.goto(await firstDetailHref(page, "events"));
  await page
    .getByRole("button", { name: /^Delete/ })
    .first()
    .click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await check(page, errors, "delete confirm");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin");
  await page.getByTestId("admin-menu-trigger").click();
  await expect(page.getByRole("dialog", { name: "Admin menu" })).toBeVisible();
  await check(page, errors, "mobile admin menu");
  await context.close();
});

test("editor: dashboard, forbidden page and inbox at 1280 and 375", async ({
  browser,
}) => {
  const { page, errors, context } = await newPage(browser, EDITOR_STATE);
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/admin", "/admin/settings", "/admin/inbox/prayer"]) {
      await page.goto(path);
      if (path === "/admin/settings") {
        await expect(page).toHaveURL(/\/admin\/forbidden$/);
      }
      await check(page, errors, `editor ${path} ${width}`);
    }
  }
  await context.close();
});

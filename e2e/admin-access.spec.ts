import { expect, test } from "@playwright/test";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";

/** The six exact admin headers; Cache-Control is checked separately (review NIT 6). */
const EXACT_HEADERS: Record<string, string> = {
  "x-frame-options": "DENY",
  "content-security-policy":
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-robots-tag": "noindex, nofollow",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function expectAdminHeaders(headers: Record<string, string>) {
  for (const [name, value] of Object.entries(EXACT_HEADERS)) {
    expect(headers[name], name).toBe(value);
  }
  // Next may set its own Cache-Control on dynamic responses; it must still be no-store.
  expect(headers["cache-control"]).toContain("no-store");
}

test.describe("signed out", () => {
  for (const path of ["/admin", "/admin/posts", "/admin/settings"]) {
    test(`GET ${path} redirects to /admin/login (AC12)`, async ({
      request,
      page,
    }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);
      const location = response.headers()["location"] ?? "";
      expect(location).toContain("/admin/login");
      expect(location).toContain(`next=${encodeURIComponent(path)}`);

      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Sign in" }),
      ).toBeVisible();
    });
  }

  test("/admin/posts keeps next=%2Fadmin%2Fposts, not next=%2Fadmin", async ({
    request,
  }) => {
    const response = await request.get("/admin/posts", { maxRedirects: 0 });
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("next=%2Fadmin%2Fposts");
    expect(location).not.toMatch(/next=%2Fadmin(&|$)/);
  });

  test("security headers on /admin/login and on the /admin redirect", async ({
    request,
  }) => {
    const login = await request.get("/admin/login");
    expect(login.status()).toBe(200);
    expectAdminHeaders(login.headers());

    const redirect = await request.get("/admin", { maxRedirects: 0 });
    expect(redirect.status()).toBeGreaterThanOrEqual(300);
    expectAdminHeaders(redirect.headers());
  });

  test("public pages get the site-wide headers only", async ({ request }) => {
    const response = await request.get("/en");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBeUndefined();
  });

  test("unknown admin URLs return the admin 404", async ({ request, page }) => {
    const response = await request.get("/admin/does-not-exist");
    expect(response.status()).toBe(404);
    await page.goto("/admin/does-not-exist");
    await expect(
      page.getByRole("heading", { level: 1, name: "Admin page not found" }),
    ).toBeVisible();
  });

  test("robots.txt disallows /admin and the sitemap has no admin URLs", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("/admin");
  });

  test("the login page is noindex", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("as an editor", () => {
  test.use({ storageState: EDITOR_STATE });

  for (const path of ["/admin/settings", "/admin/users", "/admin/audit"]) {
    test(`GET ${path} is a server redirect to /admin/forbidden (AC14)`, async ({
      request,
      page,
    }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);
      expect(response.headers()["location"] ?? "").toMatch(
        /\/admin\/forbidden$/,
      );
      const body = await response.text();
      expect(body).not.toContain('name="ministryName"');
      expect(body).not.toContain("Add editor");

      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/forbidden$/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "You don't have access to this page",
        }),
      ).toBeVisible();
      await expect(page.locator('input[name="ministryName"]')).toHaveCount(0);
    });
  }

  test("the editor nav has no owner sections", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Posts" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
  });
});

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("the owner nav shows Settings, Users and Audit log", async ({
    page,
  }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Audit log" })).toBeVisible();
  });

  test("owner pages open, and the users page counts editors", async ({
    page,
  }) => {
    await page.goto("/admin/settings");
    await expect(page.locator('input[name="ministryName"]')).toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByTestId("editor-count")).toHaveText("2 of 3 editors");
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", { level: 1, name: "Audit log" }),
    ).toBeVisible();
  });

  test("a signed-in owner visiting /admin/login goes to the dashboard", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("every content section renders for the owner", async ({ page }) => {
    for (const [path, heading] of [
      ["/admin/posts", "Posts"],
      ["/admin/categories", "Categories"],
      ["/admin/verses", "Bible verses"],
      ["/admin/events", "Events & missions"],
      ["/admin/media", "Media"],
      ["/admin/inbox/prayer", "Prayer requests"],
      ["/admin/inbox/messages", "Messages"],
      ["/admin/account", "Account"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    }
    // Empty inbox shows the launch note.
    await page.goto("/admin/inbox/prayer");
    await expect(
      page.getByText("They will appear here when the prayer form launches."),
    ).toBeVisible();
    // The media editor is honest about uploads.
    await page.goto("/admin/media/new");
    await expect(page.getByTestId("upload-note")).toContainText(
      "Uploading pictures and videos arrives in a later update.",
    );
  });
});

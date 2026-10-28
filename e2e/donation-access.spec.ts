import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";

// Read-only: nothing here writes donation rows (the main server has no keys).

const EXPORT = "/api/admin/donations/export";
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

test.describe("anonymous visitors", () => {
  test("are sent to the login page and rejected by the export", async ({
    page,
    request,
  }) => {
    await page.goto("/admin/donations");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fdonations/);
    const res = await request.get(`${EXPORT}?period=all`);
    expect(res.status()).toBe(401);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(await res.text()).not.toContain("Donor email");
  });
});

test.describe("editors", () => {
  test.use({ storageState: EDITOR_STATE });

  test("can't open the donations page or the export, and see no nav link", async ({
    page,
    request,
  }) => {
    await page.goto("/admin/donations");
    await expect(page).toHaveURL(/\/admin\/forbidden$/);
    const res = await request.get(`${EXPORT}?period=all`);
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ error: "FORBIDDEN" });
    await page.goto("/admin");
    await expect(
      page
        .getByRole("navigation", { name: "Admin" })
        .getByRole("link", { name: "Donations" }),
    ).toHaveCount(0);
  });
});

test.describe("the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("sees the Stripe status 'not set', the empty state and a header-only CSV", async ({
    page,
    request,
  }) => {
    await page.goto("/admin");
    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Donations" })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Donations" }),
    ).toBeVisible();
    await expect(
      page.getByText(/^Not set: the Support page says/),
    ).toBeVisible();
    await expect(
      page
        .getByText("No gifts recorded yet")
        .or(page.getByText("No gifts in this period")),
    ).toBeVisible();
    await expect(
      page.getByText("Online giving is not set up yet. See the README"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Export CSV" }),
    ).toHaveAttribute("href", `${EXPORT}?period=this-month`);
    const res = await request.get(`${EXPORT}?period=all`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers()["content-disposition"]).toMatch(
      /attachment; filename="donations-all-/,
    );
    const lines = (await res.text()).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"Donor email"');
  });

  for (const width of [1280, 375]) {
    test(`/admin/donations at ${width}px has no serious/critical axe violations`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/donations");
      await expect(page.getByText("Stripe connection")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});

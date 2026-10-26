import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./helpers/admin";

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
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
}

for (const width of [1280, 375]) {
  test(`/admin/login at ${width}px has no serious/critical axe violations`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/login");
    await page.evaluate(() => document.fonts.ready);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  for (const width of [1280, 375]) {
    test(`/admin dashboard at ${width}px has no serious/critical axe violations`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      await expect(
        page.getByRole("heading", { level: 1, name: "Dashboard" }),
      ).toBeVisible();
      await expect(page.getByText("Published posts")).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("/admin/posts/new at 1280px has no serious/critical axe violations", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/posts/new");
    await expect(page.getByLabel(/Title \(English\)/)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("the mobile admin menu at 375px has no serious/critical axe violations", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin");
    await page.getByTestId("admin-menu-trigger").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

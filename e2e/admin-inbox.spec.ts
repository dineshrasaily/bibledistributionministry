import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";
import {
  stubTurnstile,
  uniqueMarker,
  waitForTurnstile,
} from "./helpers/turnstile";

test.describe.configure({ mode: "serial" });

async function axeSerious(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
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

/** Sends a prayer request through the public form (anonymous page). */
async function sendPrayer(page: Page, name: string, body: string) {
  await stubTurnstile(page);
  await page.goto("/en/prayer");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel(/Your prayer request/).fill(body);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Send prayer request" }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  const name = uniqueMarker("Inbox Person");
  const body = `Inbox test body ${uniqueMarker("ib")}`;

  test("note, status and delete on a prayer request", async ({
    page,
    browser,
  }) => {
    const visitor = await browser.newContext();
    await sendPrayer(await visitor.newPage(), name, body);

    await page.goto(`/admin/inbox/prayer?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/inbox\/prayer\/[a-z0-9]+$/);
    const detailUrl = page.url();

    // Private note.
    const note = `Followed up ${uniqueMarker("note")}`;
    await page.getByLabel("Private note", { exact: true }).fill(note);
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByTestId("toasts")).toContainText("Note saved.");
    await page.reload();
    await expect(page.getByLabel("Private note", { exact: true })).toHaveValue(
      note,
    );

    // Status.
    await page.getByLabel("Status", { exact: true }).selectOption("PRAYED");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByTestId("toasts")).toContainText("Status updated.");
    await page.reload();
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
      "PRAYED",
    );

    // The note is never public.
    const pub = await visitor.newPage();
    await pub.goto("/en/prayer");
    await expect(pub.locator("body")).not.toContainText(note);
    await visitor.close();

    // Delete.
    await page
      .getByRole("button", { name: "Delete this prayer request" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("can't be undone");
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/inbox\/prayer$/);
    await expect(page.getByTestId("toasts")).toContainText("Deleted.");
    await page.goto(detailUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: "Admin page not found" }),
    ).toBeVisible();
    await page.goto(`/admin/inbox/prayer?q=${encodeURIComponent(name)}`);
    await expect(page.getByText("No matching prayer requests")).toBeVisible();
  });

  test("inbox settings: retention, purge and service status", async ({
    page,
  }) => {
    const keepName = uniqueMarker("Keep Person");
    const visitor = await page.context().browser()!.newContext();
    await sendPrayer(await visitor.newPage(), keepName, "Recent request.");
    await visitor.close();

    await page.goto("/admin/inbox/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Inbox settings" }),
    ).toBeVisible();
    await expect(page.getByTestId("turnstile-status")).toHaveText(
      "Cloudflare Turnstile (test keys – not configured)",
    );
    await expect(page.getByTestId("email-status")).toHaveText(
      "Resend not configured (notices are logged)",
    );

    const months = page.getByLabel(/Keep prayer requests and messages for/);
    await months.fill("0");
    await page.getByRole("button", { name: "Save retention" }).click();
    await expect(page.getByTestId("form-error-summary")).toContainText(
      "from 1 to 60",
    );
    await months.fill("6");
    await page.getByRole("button", { name: "Save retention" }).click();
    await expect(page.getByTestId("toasts")).toContainText("Retention saved.");
    await page.reload();
    await expect(months).toHaveValue("6");
    await expect(page.getByTestId("purge-preview")).toHaveText(
      "0 prayer requests and 0 messages",
    );

    expect(await axeSerious(page)).toEqual([]);

    await page.getByRole("button", { name: "Delete old items" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete old items" }).click();
    await expect(page.getByTestId("toasts")).toContainText(
      "Deleted 0 prayer requests and 0 messages.",
    );
    await page.reload();
    await expect(page.getByText("Never", { exact: true })).toHaveCount(0);

    // Recent items stay.
    await page.goto(`/admin/inbox/prayer?q=${encodeURIComponent(keepName)}`);
    await expect(
      page.getByRole("link", { name: keepName, exact: true }),
    ).toBeVisible();
  });

  test("inbox settings at 375px has no serious/critical axe violations", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/inbox/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Inbox settings" }),
    ).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
});

test.describe("as an editor", () => {
  test.use({ storageState: EDITOR_STATE });

  test("inbox settings are forbidden and not in the nav", async ({ page }) => {
    await page.goto("/admin/inbox/settings");
    await expect(page).toHaveURL(/\/admin\/forbidden$/);
    await page.goto("/admin");
    await expect(
      page
        .getByRole("navigation", { name: "Admin" })
        .getByRole("link", { name: "Inbox settings" }),
    ).toHaveCount(0);
  });
});

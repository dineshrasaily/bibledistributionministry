import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import { getVerseOfTheDay } from "../src/lib/verse-of-the-day";
import { EDITOR_STATE, OWNER_STATE } from "./helpers/admin";
import { seriousViolations } from "./helpers/axe";
import {
  VERSE_DEFAULTS,
  deleteVersesNamed,
  resetVerseSettings,
  setVerseSettings,
  siteToday,
  verseSection,
} from "./helpers/verse-of-day";

/** Today's automatic verse with the seeded settings (New York). */
const autoVerse = () =>
  getVerseOfTheDay(new Date(), VERSE_DEFAULTS.timeZone).verse;

test.describe("automatic verse of the day (owner)", () => {
  test.use({ storageState: OWNER_STATE });
  test.describe.configure({ mode: "serial" });

  test("the home page shows today's WEB verse without a demo badge", async ({
    page,
  }) => {
    const verse = autoVerse();
    await page.goto("/en");
    const section = verseSection(page);
    await expect(section.locator("cite")).toHaveText(
      `${verse.reference} (WEB)`,
    );
    await expect(section.locator("blockquote")).toHaveText(verse.web);
    await expect(section.locator("blockquote")).not.toHaveAttribute(
      "lang",
      /.+/,
    );
    await expect(section.locator("[data-demo-badge]")).toHaveCount(0);

    // The admin preview tells the owner the same thing.
    await page.goto("/admin/verses");
    const preview = page.getByTestId("today-verse-preview");
    await expect(preview).toContainText(VERSE_DEFAULTS.timeZone);
    await expect(preview.getByTestId("today-auto")).toHaveText(
      `${verse.reference} (WEB)`,
    );
    await expect(preview.getByTestId("today-override")).toContainText(
      "No override today",
    );
  });

  test("an owner override for today replaces the automatic verse", async ({
    page,
  }) => {
    const reference = "E2E Override 1:1";
    try {
      await page.goto("/admin/verses/new");
      await page.getByLabel(/^Reference/).fill(reference);
      await page
        .getByLabel(/^Verse text \(English\)/)
        .fill("E2E override verse text.");
      await page
        .getByLabel("Verse of the day on (optional)", { exact: true })
        .fill(siteToday());
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(page).toHaveURL(/toast=created/);

      await page.goto("/en");
      const section = verseSection(page);
      await expect(section.locator("cite")).toHaveText(`${reference} (WEB)`);
      await expect(section.locator("blockquote")).toHaveText(
        "E2E override verse text.",
      );
      await expect(section.locator("[data-demo-badge]")).toHaveCount(0);

      await page.goto("/admin/verses");
      const preview = page.getByTestId("today-verse-preview");
      await expect(preview.getByTestId("today-override")).toContainText(
        "Override active today",
      );
      await expect(preview.getByTestId("today-override")).toContainText(
        `${reference} (WEB)`,
      );
    } finally {
      await deleteVersesNamed(page, reference);
    }
    await page.goto("/en");
    await expect(verseSection(page).locator("cite")).toHaveText(
      `${autoVerse().reference} (WEB)`,
    );
  });

  test("switching the translation to KJV changes the suffix to (KJV)", async ({
    page,
  }) => {
    const verse = autoVerse();
    try {
      await setVerseSettings(page, { translation: "KJV" });
      await page.goto("/en");
      const section = verseSection(page);
      await expect(section.locator("cite")).toHaveText(
        `${verse.reference} (KJV)`,
      );
      await expect(section.locator("blockquote")).toHaveText(verse.kjv);
      // Nepali pages name the translation in the note too.
      await page.goto("/ne");
      await expect(verseSection(page)).toContainText("KJV");
    } finally {
      await resetVerseSettings(page);
    }
    await page.goto("/en");
    await expect(verseSection(page).locator("cite")).toHaveText(
      `${verse.reference} (WEB)`,
    );
  });

  test("turning the automatic verse off shows the previous featured verse", async ({
    page,
  }) => {
    try {
      await setVerseSettings(page, { enabled: false });
      await page.goto("/en");
      // The seeded demo verse is the most recent past featured verse.
      await expect(verseSection(page).locator("cite")).toHaveText(
        "Isaiah 6:8 (WEB)",
      );
      await page.goto("/admin/verses");
      await expect(page.getByTestId("today-auto")).toContainText(
        "The automatic verse is off",
      );
    } finally {
      await resetVerseSettings(page);
    }
  });

  test("the Nepali home shows the English verse marked lang=en with a note", async ({
    page,
  }) => {
    const verse = autoVerse();
    await page.goto("/ne");
    const section = verseSection(page);
    const quote = section.locator('blockquote[lang="en"]');
    await expect(quote).toHaveText(verse.web);
    await expect(section.locator("cite")).toHaveText(
      `${verse.reference} (WEB)`,
    );
    await expect(section).toContainText("अंग्रेजी WEB पाठ");
    await expect(section.locator("[data-demo-badge]")).toHaveCount(0);
  });

  test("axe: no serious or critical violations on home and Settings", async ({
    page,
  }) => {
    for (const path of ["/en", "/ne", "/admin/settings", "/admin/verses"]) {
      await page.goto(path);
      expect(await seriousViolations(page, "verse of the day"), path).toEqual(
        [],
      );
    }
  });
});

test.describe("verse of the day settings are owner-only", () => {
  test("an EDITOR cannot save them, even by replaying the owner's request", async ({
    browser,
  }) => {
    // 1. The owner's real "Save settings" request with KJV selected, captured
    //    and aborted (so nothing is saved).
    const ownerContext = await browser.newContext({
      storageState: OWNER_STATE,
    });
    const owner = await ownerContext.newPage();
    await owner.goto("/admin/settings");
    await owner.getByLabel("Translation", { exact: true }).selectOption("KJV");
    const captured = new Promise<{
      headers: Record<string, string>;
      body: Buffer;
    }>((resolve) => {
      void owner.route("**/admin/settings", async (route) => {
        const request = route.request();
        if (request.method() !== "POST") return route.continue();
        resolve({
          headers: await request.allHeaders(),
          body: request.postDataBuffer() ?? Buffer.from(""),
        });
        await route.abort();
      });
    });
    await owner.getByRole("button", { name: "Save settings" }).click();
    const { headers, body } = await captured;
    expect(headers["next-action"]).toBeTruthy();

    // 2. The editor sends the same server action request.
    const editorContext = await browser.newContext({
      storageState: EDITOR_STATE,
    });
    try {
      const response = await editorContext.request.post("/admin/settings", {
        headers: {
          "content-type": headers["content-type"]!,
          "next-action": headers["next-action"]!,
          accept: headers["accept"] ?? "text/x-component",
          origin: new URL(owner.url()).origin,
        },
        data: body,
      });
      expect(await response.text()).toContain("FORBIDDEN");

      // The page itself is forbidden for editors.
      const editor = await editorContext.newPage();
      await editor.goto("/admin/settings");
      await expect(editor).toHaveURL(/\/admin\/forbidden$/);
      await expect(
        editor.getByRole("heading", { name: "Verse of the day" }),
      ).toHaveCount(0);

      // 3. Nothing changed: still WEB.
      await owner.unroute("**/admin/settings");
      await owner.goto("/admin/settings");
      await expect(
        owner.getByLabel("Translation", { exact: true }),
      ).toHaveValue("WEB");
      await owner.goto("/en");
      await expect(verseSection(owner).locator("cite")).toHaveText(
        `${autoVerse().reference} (WEB)`,
      );
    } finally {
      await editorContext.close();
      await ownerContext.close();
    }
  });
});

test("the verse section heading is the localized eyebrow", async ({ page }) => {
  await page.goto("/en");
  await expect(verseSection(page).getByRole("heading")).toHaveText(
    en.Home.verseEyebrow,
  );
});

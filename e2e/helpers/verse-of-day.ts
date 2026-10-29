import { expect, type Page } from "@playwright/test";
import { siteDay } from "../../src/lib/verse-of-the-day";

/** Admin -> Settings labels of the "Verse of the day" section. */
export const VERSE_LABELS = {
  enabled: "Show an automatic verse every day",
  translation: "Translation",
  timeZone: "Ministry time zone",
} as const;

export type VerseSettings = {
  enabled?: boolean;
  translation?: "WEB" | "KJV";
  timeZone?: string;
};

/** Seeded defaults (restored in finally blocks). */
export const VERSE_DEFAULTS: Required<VerseSettings> = {
  enabled: true,
  translation: "WEB",
  timeZone: "America/New_York",
};

/** Today (YYYY-MM-DD) in the seeded site time zone. */
export const siteToday = (timeZone = VERSE_DEFAULTS.timeZone) =>
  siteDay(new Date(), timeZone).iso;

export const verseSection = (page: Page) =>
  page.locator('section[aria-labelledby="verse-heading"]');

/** Opens Admin -> Settings, applies `values`, saves and waits for the toast. */
export async function setVerseSettings(page: Page, values: VerseSettings) {
  await page.goto("/admin/settings");
  if (values.enabled !== undefined) {
    await page
      .getByLabel(VERSE_LABELS.enabled, { exact: true })
      .setChecked(values.enabled);
  }
  if (values.translation) {
    await page
      .getByLabel(VERSE_LABELS.translation, { exact: true })
      .selectOption(values.translation);
  }
  if (values.timeZone) {
    await page
      .getByLabel(VERSE_LABELS.timeZone, { exact: true })
      .selectOption(values.timeZone);
  }
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("toasts")).toContainText("Settings saved.");
}

export const resetVerseSettings = (page: Page) =>
  setVerseSettings(page, VERSE_DEFAULTS);

/** Deletes every verse whose reference matches `reference` (Admin -> Bible verses). */
export async function deleteVersesNamed(page: Page, reference: string) {
  for (let i = 0; i < 5; i++) {
    await page.goto(`/admin/verses?q=${encodeURIComponent(reference)}`);
    const trigger = page.getByRole("button", { name: "Delete", exact: true });
    if ((await trigger.count()) === 0) return;
    await trigger.first().click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL(/toast=deleted/);
  }
}

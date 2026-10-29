import { expect, type Page } from "@playwright/test";

/** Admin -> Settings labels of the "Zelle and bank transfer" section. */
export const OFFLINE_LABELS = {
  enabled: "Show Zelle and bank transfer on the Support page",
  recipient: "Zelle recipient name",
  email: "Zelle email (optional)",
  phone: "Zelle phone (optional)",
  qr: "Zelle QR code picture (optional)",
  qrAltEn: "QR code description (English)",
  qrAltNe: "QR code description (नेपाली, Nepali)",
  bankName: "Bank name",
  holder: "Account holder name",
  account: "Account number",
  routing: "Routing number (ABA, 9 digits)",
  swift: "SWIFT/BIC code (optional, for gifts from outside the US)",
  address: "Bank address (optional)",
  showDetails:
    "Show the account, routing and SWIFT numbers on the Support page",
  noteEn: "Note for donors (English)",
  noteNe: "Note for donors (नेपाली, Nepali)",
} as const;

type TextKey = Exclude<keyof typeof OFFLINE_LABELS, "enabled" | "showDetails">;

export type OfflineValues = Partial<Record<TextKey, string>> & {
  enabled?: boolean;
  showDetails?: boolean;
};

/** Example data for tests only (never real details). */
export const E2E_OFFLINE: OfflineValues = {
  enabled: true,
  recipient: "E2E Ministry Zelle",
  email: "give@example.org",
  phone: "(555) 010-0199",
  qr: "/brand/logo-mark.png",
  qrAltEn: "E2E Zelle QR",
  bankName: "E2E Community Bank",
  holder: "E2E Ministry",
  account: "000123456789",
  routing: "021000021",
  swift: "CHASUS33",
  address: "100 Example Street\nSpringfield, ST 00000",
  noteEn: "Please write 'Bibles' in the memo",
  showDetails: false,
};

const TEXT_KEYS = Object.keys(OFFLINE_LABELS).filter(
  (k) => k !== "enabled" && k !== "showDetails",
) as TextKey[];

/** Fills the given fields on Admin -> Settings (page must be open). */
export async function fillOfflineFields(page: Page, values: OfflineValues) {
  for (const key of TEXT_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    await page.getByLabel(OFFLINE_LABELS[key], { exact: true }).fill(value);
  }
  if (values.enabled !== undefined) {
    await page
      .getByLabel(OFFLINE_LABELS.enabled, { exact: true })
      .setChecked(values.enabled);
  }
  if (values.showDetails !== undefined) {
    await page
      .getByLabel(OFFLINE_LABELS.showDetails, { exact: true })
      .setChecked(values.showDetails);
  }
}

export async function saveSettings(page: Page) {
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByTestId("toasts")).toContainText("Settings saved.");
}

/** Opens Settings, fills the Zelle/bank fields and saves. */
export async function fillOfflineGiving(page: Page, values: OfflineValues) {
  await page.goto("/admin/settings");
  await fillOfflineFields(page, values);
  await saveSettings(page);
}

/** Clears every Zelle/bank field and turns both toggles off. */
export async function resetOfflineGiving(page: Page) {
  await page.goto("/admin/settings");
  await fillOfflineFields(page, {
    ...Object.fromEntries(TEXT_KEYS.map((k) => [k, ""])),
    enabled: false,
    showDetails: false,
  });
  await saveSettings(page);
}

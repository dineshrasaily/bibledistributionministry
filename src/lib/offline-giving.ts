/**
 * Pure mapping from SiteSettings to the "Give by Zelle or bank transfer"
 * section of the Support page. Returns null when the section must not render.
 * Account, routing and SWIFT numbers are only included when the owner turned
 * on bankShowAccountDetails, so hidden numbers never reach the HTML.
 * Unit tested.
 */
import type { SiteSettings } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { isSafeUrl } from "./validation/common";
import { zelleQrDefaultAlt } from "./validation/settings";

export const OFFLINE_GIVING_FIELDS = [
  "offlineGivingEnabled",
  "zelleRecipientName",
  "zelleEmail",
  "zellePhone",
  "zelleQrUrl",
  "zelleQrAltEn",
  "zelleQrAltNe",
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "bankRoutingNumber",
  "bankSwiftCode",
  "bankAddress",
  "bankShowAccountDetails",
  "offlineGivingNoteEn",
  "offlineGivingNoteNe",
] as const satisfies readonly (keyof SiteSettings)[];
export type OfflineGivingRow = Pick<
  SiteSettings,
  (typeof OFFLINE_GIVING_FIELDS)[number]
>;

export type ZelleCard = {
  recipientName: string;
  email: string | null;
  phone: string | null;
  qr: { url: string; alt: string } | null;
};
export type BankDetails = {
  accountNumber: string | null;
  routingNumber: string | null;
  swiftCode: string | null;
};
export type BankCard = {
  bankName: string | null;
  accountName: string | null;
  address: string | null;
  /** null = hidden: show "Contact us for bank transfer details". */
  details: BankDetails | null;
};
export type OfflineGiving = {
  zelle: ZelleCard | null;
  bank: BankCard | null;
  /** textLang "en" when a Nepali page shows the English note. */
  note: { text: string; textLang: "en" | undefined } | null;
};

/** Trimmed value, or null when missing / whitespace only. */
const clean = (v: string | null | undefined): string | null => {
  const s = v?.trim() ?? "";
  return s === "" ? null : s;
};

function zelleCard(row: OfflineGivingRow, locale: AppLocale): ZelleCard | null {
  const recipientName = clean(row.zelleRecipientName);
  if (!recipientName) return null;
  const email = clean(row.zelleEmail);
  const phone = clean(row.zellePhone);
  const url = clean(row.zelleQrUrl);
  const altEn = clean(row.zelleQrAltEn);
  const altNe = clean(row.zelleQrAltNe);
  const qr =
    url && isSafeUrl(url)
      ? {
          url,
          alt:
            (locale === "ne" ? altNe : null) ??
            altEn ??
            zelleQrDefaultAlt(recipientName),
        }
      : null;
  if (!email && !phone && !qr) return null;
  return { recipientName, email, phone, qr };
}

function bankCard(row: OfflineGivingRow): BankCard | null {
  const bankName = clean(row.bankName);
  const accountName = clean(row.bankAccountName);
  const accountNumber = clean(row.bankAccountNumber);
  const routingNumber = clean(row.bankRoutingNumber);
  const swiftCode = clean(row.bankSwiftCode);
  if (
    !bankName &&
    !accountName &&
    !accountNumber &&
    !routingNumber &&
    !swiftCode
  ) {
    return null;
  }
  const details =
    row.bankShowAccountDetails && (accountNumber || routingNumber || swiftCode)
      ? { accountNumber, routingNumber, swiftCode }
      : null;
  return { bankName, accountName, address: clean(row.bankAddress), details };
}

function noteOf(
  row: OfflineGivingRow,
  locale: AppLocale,
): OfflineGiving["note"] {
  const en = clean(row.offlineGivingNoteEn);
  const ne = clean(row.offlineGivingNoteNe);
  if (locale === "ne" && ne) return { text: ne, textLang: undefined };
  if (en) return { text: en, textLang: locale === "ne" ? "en" : undefined };
  return null;
}

/** null when the section must not render at all. */
export function toOfflineGiving(
  row: OfflineGivingRow,
  locale: AppLocale,
): OfflineGiving | null {
  if (!row.offlineGivingEnabled) return null;
  const zelle = zelleCard(row, locale);
  const bank = bankCard(row);
  // The note alone never shows the section.
  if (!zelle && !bank) return null;
  return { zelle, bank, note: noteOf(row, locale) };
}

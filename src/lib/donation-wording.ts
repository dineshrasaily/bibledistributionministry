/**
 * Donation tax wording, driven by SiteSettings.taxDeductibleVerified (OWNER
 * only). Never claims charitable status; even when verified it only says
 * gifts *may* qualify. Pure module (Terms, Support and thank-you pages).
 * All tax wording lives here: the message files must never contain it.
 */
import type { AppLocale } from "@/i18n/routing";

const NOTES: Record<AppLocale, { verified: string; unverified: string }> = {
  en: {
    unverified: "Gifts are not tax-deductible.",
    verified:
      "Gifts may be tax-deductible; consult your tax advisor. Stripe emails a receipt for each gift.",
  },
  ne: {
    unverified: "दानहरू करमा छुट पाउने (tax-deductible) होइनन्।",
    verified:
      "दानहरू करमा छुट पाउने (tax-deductible) हुन सक्छन्; आफ्नो कर सल्लाहकारसँग सोध्नुहोस्। प्रत्येक दानको रसिद Stripe ले इमेलमा पठाउँछ।",
  },
};

/** Zelle/bank gifts: same rule, but no Stripe receipt claim. */
const OFFLINE_NOTES: Record<
  AppLocale,
  { verified: string; unverified: string }
> = {
  en: {
    unverified: NOTES.en.unverified,
    verified: "Gifts may be tax-deductible; consult your tax advisor.",
  },
  ne: {
    unverified: NOTES.ne.unverified,
    verified:
      "दानहरू करमा छुट पाउने (tax-deductible) हुन सक्छन्; आफ्नो कर सल्लाहकारसँग सोध्नुहोस्।",
  },
};

/** Tax line for Zelle/bank gifts on the Support page. */
export function offlineTaxNote(
  locale: AppLocale,
  taxDeductibleVerified: boolean,
): string {
  const notes = OFFLINE_NOTES[locale];
  return taxDeductibleVerified ? notes.verified : notes.unverified;
}

export function donationTaxNote(
  locale: AppLocale,
  taxDeductibleVerified: boolean,
): string {
  const notes = NOTES[locale];
  return taxDeductibleVerified ? notes.verified : notes.unverified;
}

/**
 * The tax line of the giving disclosure (Support and thank-you pages). Same
 * text as the Terms (donationTaxNote), so all three pages always agree. The
 * other disclosure lines make no tax claim and live in the message files.
 */
export function donationDisclosure(
  locale: AppLocale,
  taxDeductibleVerified: boolean,
): { taxNote: string } {
  return { taxNote: donationTaxNote(locale, taxDeductibleVerified) };
}

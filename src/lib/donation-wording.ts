/**
 * Donation tax wording, driven by SiteSettings.taxDeductibleVerified (OWNER
 * only). Never claims charitable status; even when verified it only says
 * gifts *may* qualify. Pure module (reused by the Phase 8 Support page).
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

export function donationTaxNote(
  locale: AppLocale,
  taxDeductibleVerified: boolean,
): string {
  const notes = NOTES[locale];
  return taxDeductibleVerified ? notes.verified : notes.unverified;
}

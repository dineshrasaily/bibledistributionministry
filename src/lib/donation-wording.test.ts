import { describe, expect, it } from "vitest";
import { donationDisclosure, donationTaxNote } from "./donation-wording";

describe("donationTaxNote", () => {
  it("says gifts are not tax-deductible until verified", () => {
    expect(donationTaxNote("en", false)).toBe("Gifts are not tax-deductible.");
    expect(donationTaxNote("ne", false)).toMatch(/होइनन्/);
  });

  it("unverified wording never hedges with 'may' or 'consult'", () => {
    const en = donationTaxNote("en", false);
    expect(en).not.toMatch(/\bmay\b/i);
    expect(en).not.toMatch(/consult/i);
    expect(en).not.toMatch(/receipt/i);
  });

  it("uses neutral 'may be' wording plus a receipt note when verified", () => {
    const en = donationTaxNote("en", true);
    expect(en).toMatch(/may be tax-deductible/);
    expect(en).toMatch(/consult your tax advisor/);
    expect(en).toMatch(/receipt/);
    expect(donationTaxNote("ne", true)).toMatch(/Stripe/);
    expect(donationTaxNote("ne", true)).toMatch(/सल्लाहकार/);
  });

  it("never claims charitable status or that gifts ARE deductible", () => {
    for (const locale of ["en", "ne"] as const) {
      for (const verified of [true, false]) {
        const note = donationTaxNote(locale, verified);
        expect(note).not.toMatch(
          /501\(c\)|registered charity|charitable organi[sz]ation|charity/i,
        );
        expect(note).not.toMatch(/\b(is|are) tax-deductible/i);
      }
    }
  });
});

describe("donationDisclosure", () => {
  it("matches the Terms wording in every case", () => {
    for (const locale of ["en", "ne"] as const) {
      for (const verified of [true, false]) {
        expect(donationDisclosure(locale, verified)).toEqual({
          taxNote: donationTaxNote(locale, verified),
        });
      }
    }
  });
});

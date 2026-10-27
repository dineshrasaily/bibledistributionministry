import { describe, expect, it } from "vitest";
import { donationTaxNote } from "./donation-wording";

describe("donationTaxNote", () => {
  it("says gifts are not tax-deductible until verified", () => {
    expect(donationTaxNote("en", false)).toBe("Gifts are not tax-deductible.");
    expect(donationTaxNote("ne", false)).toMatch(/होइनन्/);
  });

  it("uses neutral 'may be' wording plus a receipt note when verified", () => {
    const en = donationTaxNote("en", true);
    expect(en).toMatch(/may be tax-deductible/);
    expect(en).toMatch(/consult your tax advisor/);
    expect(en).toMatch(/receipt/);
    expect(donationTaxNote("ne", true)).toMatch(/Stripe/);
  });

  it("never claims charitable status", () => {
    for (const locale of ["en", "ne"] as const) {
      for (const verified of [true, false]) {
        expect(donationTaxNote(locale, verified)).not.toMatch(
          /501\(c\)|registered charity|charitable organi[sz]ation/i,
        );
      }
    }
  });
});

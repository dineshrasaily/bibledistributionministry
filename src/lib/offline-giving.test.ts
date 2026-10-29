import { describe, expect, it } from "vitest";
import { defaultSiteSettings } from "@/config/site";
import { toOfflineGiving, type OfflineGivingRow } from "./offline-giving";

const row = (overrides: Partial<OfflineGivingRow> = {}): OfflineGivingRow => ({
  ...defaultSiteSettings,
  ...overrides,
});

const FULL: Partial<OfflineGivingRow> = {
  offlineGivingEnabled: true,
  zelleRecipientName: "Grace Church",
  zelleEmail: "give@example.org",
  zellePhone: "(555) 010-0199",
  zelleQrUrl: "/brand/logo-mark.png",
  zelleQrAltEn: "Grace Church Zelle QR",
  bankName: "Example Bank",
  bankAccountName: "Grace Church",
  bankAccountNumber: "000123456789",
  bankRoutingNumber: "021000021",
  bankSwiftCode: "CHASUS33",
  bankAddress: "1 Main St",
};

describe("toOfflineGiving", () => {
  it("is hidden when the toggle is off, even with everything filled", () => {
    expect(
      toOfflineGiving(row({ ...FULL, offlineGivingEnabled: false }), "en"),
    ).toBeNull();
  });

  it("is hidden when on but every field is empty", () => {
    expect(
      toOfflineGiving(row({ offlineGivingEnabled: true }), "en"),
    ).toBeNull();
  });

  it("is hidden with only a note or only a recipient name", () => {
    expect(
      toOfflineGiving(
        row({
          offlineGivingEnabled: true,
          offlineGivingNoteEn: "Memo: Bibles",
        }),
        "en",
      ),
    ).toBeNull();
    expect(
      toOfflineGiving(
        row({ offlineGivingEnabled: true, zelleRecipientName: "Grace Church" }),
        "en",
      ),
    ).toBeNull();
  });

  it("treats whitespace-only values as empty", () => {
    expect(
      toOfflineGiving(
        row({
          offlineGivingEnabled: true,
          zelleRecipientName: "  ",
          zelleEmail: " ",
          bankName: "   ",
        }),
        "en",
      ),
    ).toBeNull();
  });

  it("builds a Zelle card from a name and an email only", () => {
    const g = toOfflineGiving(
      row({
        offlineGivingEnabled: true,
        zelleRecipientName: " Grace Church ",
        zelleEmail: "give@example.org",
      }),
      "en",
    );
    expect(g?.zelle).toEqual({
      recipientName: "Grace Church",
      email: "give@example.org",
      phone: null,
      qr: null,
    });
    expect(g?.bank).toBeNull();
  });

  it("drops an unsafe QR URL", () => {
    const g = toOfflineGiving(
      row({ ...FULL, zelleQrUrl: "javascript:alert(1)" }),
      "en",
    );
    expect(g?.zelle?.qr).toBeNull();
  });

  it("QR alt: Nepali, then English, then the default", () => {
    const withNe = row({ ...FULL, zelleQrAltNe: "Zelle QR (ne)" });
    expect(toOfflineGiving(withNe, "ne")?.zelle?.qr?.alt).toBe("Zelle QR (ne)");
    expect(toOfflineGiving(withNe, "en")?.zelle?.qr?.alt).toBe(
      "Grace Church Zelle QR",
    );
    expect(toOfflineGiving(row(FULL), "ne")?.zelle?.qr?.alt).toBe(
      "Grace Church Zelle QR",
    );
    expect(
      toOfflineGiving(row({ ...FULL, zelleQrAltEn: null }), "en")?.zelle?.qr
        ?.alt,
    ).toBe("Zelle QR code for Grace Church");
  });

  it("shows a bank card with only the bank name", () => {
    const g = toOfflineGiving(
      row({ offlineGivingEnabled: true, bankName: "Example Bank" }),
      "en",
    );
    expect(g?.zelle).toBeNull();
    expect(g?.bank).toEqual({
      bankName: "Example Bank",
      accountName: null,
      address: null,
      details: null,
    });
  });

  it("hides account, routing and SWIFT unless bankShowAccountDetails is on", () => {
    const g = toOfflineGiving(row(FULL), "en");
    expect(g?.bank?.details).toBeNull();
    const json = JSON.stringify(g);
    expect(json).not.toContain("000123456789");
    expect(json).not.toContain("021000021");
    expect(json).not.toContain("CHASUS33");
  });

  it("shows the details when bankShowAccountDetails is on", () => {
    const g = toOfflineGiving(
      row({ ...FULL, bankShowAccountDetails: true }),
      "en",
    );
    expect(g?.bank?.details).toEqual({
      accountNumber: "000123456789",
      routingNumber: "021000021",
      swiftCode: "CHASUS33",
    });
  });

  it("details stay null when on but no number, routing or SWIFT is set", () => {
    const g = toOfflineGiving(
      row({
        offlineGivingEnabled: true,
        bankName: "Example Bank",
        bankShowAccountDetails: true,
      }),
      "en",
    );
    expect(g?.bank?.details).toBeNull();
  });

  it("note: Nepali when present, else English marked lang=en on ne", () => {
    const en = row({ ...FULL, offlineGivingNoteEn: "Memo: Bibles" });
    expect(toOfflineGiving(en, "en")?.note).toEqual({
      text: "Memo: Bibles",
      textLang: undefined,
    });
    expect(toOfflineGiving(en, "ne")?.note).toEqual({
      text: "Memo: Bibles",
      textLang: "en",
    });
    const both = row({
      ...FULL,
      offlineGivingNoteEn: "Memo: Bibles",
      offlineGivingNoteNe: "मेमो: बाइबल",
    });
    expect(toOfflineGiving(both, "ne")?.note).toEqual({
      text: "मेमो: बाइबल",
      textLang: undefined,
    });
    expect(toOfflineGiving(row(FULL), "en")?.note).toBeNull();
  });
});

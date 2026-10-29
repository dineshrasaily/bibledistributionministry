import { describe, expect, it } from "vitest";
import { URL_MSG } from "./common";
import {
  ACCOUNT_NUMBER_MSG,
  BANK_DETAILS_MISSING_MSG,
  PHONE_MSG,
  ROUTING_MSG,
  SWIFT_MSG,
  ZELLE_NAME_REQUIRED_MSG,
  settingsSchema,
} from "./settings";

const base = { ministryName: "X", contactEmail: "a@b.org" };

const parse = (extra: Record<string, unknown>) =>
  settingsSchema.safeParse({ ...base, ...extra });

const ok = (extra: Record<string, unknown>) => {
  const result = parse(extra);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
};

/** The first issue message for `field`, or undefined. */
const errorOf = (extra: Record<string, unknown>, field: string) => {
  const result = parse(extra);
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path[0] === field)?.message;
};

const STRING_FIELDS = [
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
  "offlineGivingNoteEn",
  "offlineGivingNoteNe",
] as const;

describe("settingsSchema: Zelle and bank transfer", () => {
  it("blank, whitespace and missing values become null; toggles off", () => {
    for (const blank of ["", "   ", undefined]) {
      const data = ok(Object.fromEntries(STRING_FIELDS.map((f) => [f, blank])));
      for (const f of STRING_FIELDS) expect(data[f], f).toBeNull();
      expect(data.offlineGivingEnabled).toBe(false);
      expect(data.bankShowAccountDetails).toBe(false);
    }
  });

  it("checkbox 'on' turns the section on", () => {
    expect(ok({ offlineGivingEnabled: "on" }).offlineGivingEnabled).toBe(true);
  });

  it("accepts loose US phone formats", () => {
    const name = { zelleRecipientName: "Grace Church" };
    expect(ok({ ...name, zellePhone: "(555) 010-0199" }).zellePhone).toBe(
      "(555) 010-0199",
    );
    expect(ok({ ...name, zellePhone: "+1 555.010.0199" }).zellePhone).toBe(
      "+1 555.010.0199",
    );
  });

  it("rejects short, lettered, digit-less and over-long phones", () => {
    const name = { zelleRecipientName: "Grace Church" };
    for (const phone of [
      "12345",
      "555-CALL-NOW",
      "(((---)))",
      "1".repeat(21),
    ]) {
      expect(errorOf({ ...name, zellePhone: phone }, "zellePhone"), phone).toBe(
        phone.length > 20 ? "Use at most 20 characters" : PHONE_MSG,
      );
    }
  });

  it("lower-cases the Zelle email and rejects invalid ones", () => {
    const name = { zelleRecipientName: "Grace Church" };
    expect(ok({ ...name, zelleEmail: "Give@Example.org" }).zelleEmail).toBe(
      "give@example.org",
    );
    expect(
      errorOf({ ...name, zelleEmail: "not-an-email" }, "zelleEmail"),
    ).toBeDefined();
  });

  it("normalizes a valid routing number and rejects a bad checksum", () => {
    expect(ok({ bankRoutingNumber: " 021-000-021 " }).bankRoutingNumber).toBe(
      "021000021",
    );
    expect(
      errorOf({ bankRoutingNumber: "123456789" }, "bankRoutingNumber"),
    ).toBe(ROUTING_MSG);
    expect(
      errorOf({ bankRoutingNumber: "02100002" }, "bankRoutingNumber"),
    ).toBe(ROUTING_MSG);
  });

  it("normalizes the account number and rejects bad ones", () => {
    expect(ok({ bankAccountNumber: "0001 2345 6789" }).bankAccountNumber).toBe(
      "000123456789",
    );
    for (const n of ["123", "12ab34", "1".repeat(18)]) {
      expect(errorOf({ bankAccountNumber: n }, "bankAccountNumber"), n).toBe(
        ACCOUNT_NUMBER_MSG,
      );
    }
  });

  it("upper-cases SWIFT/BIC codes and checks 8 or 11 characters", () => {
    expect(ok({ bankSwiftCode: "bofaus3n" }).bankSwiftCode).toBe("BOFAUS3N");
    expect(ok({ bankSwiftCode: "CHASUS33XXX" }).bankSwiftCode).toBe(
      "CHASUS33XXX",
    );
    for (const code of ["BOFAUS", "1234US33", "BOFAUS3NX"]) {
      expect(errorOf({ bankSwiftCode: code }, "bankSwiftCode"), code).toBe(
        SWIFT_MSG,
      );
    }
  });

  it("defaults the QR description from the recipient name", () => {
    const data = ok({
      zelleRecipientName: "Grace Church",
      zelleQrUrl: "/brand/logo-mark.png",
      zelleQrAltEn: "",
    });
    expect(data.zelleQrAltEn).toBe("Zelle QR code for Grace Church");
    const kept = ok({
      zelleRecipientName: "Grace Church",
      zelleQrUrl: "/brand/logo-mark.png",
      zelleQrAltEn: "My QR",
    });
    expect(kept.zelleQrAltEn).toBe("My QR");
  });

  it("no QR: the description stays empty", () => {
    expect(ok({ zelleRecipientName: "Grace Church" }).zelleQrAltEn).toBeNull();
  });

  it("requires the recipient name with an email, phone or QR", () => {
    for (const extra of [
      { zelleEmail: "give@example.org" },
      { zellePhone: "(555) 010-0199" },
      { zelleQrUrl: "/brand/logo-mark.png" },
    ]) {
      expect(errorOf(extra, "zelleRecipientName")).toBe(
        ZELLE_NAME_REQUIRED_MSG,
      );
    }
  });

  it("showing account details needs a number, routing or SWIFT", () => {
    expect(errorOf({ bankShowAccountDetails: "on" }, "bankAccountNumber")).toBe(
      BANK_DETAILS_MISSING_MSG,
    );
    expect(
      ok({ bankShowAccountDetails: "on", bankRoutingNumber: "021000021" })
        .bankShowAccountDetails,
    ).toBe(true);
  });

  it("rejects unsafe QR URLs", () => {
    expect(
      errorOf(
        {
          zelleRecipientName: "Grace Church",
          zelleQrUrl: "javascript:alert(1)",
        },
        "zelleQrUrl",
      ),
    ).toBe(URL_MSG);
  });
});

import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "./account";
import { loginStep1Schema, totpCodeSchema } from "./auth";
import { prayerStatusSchema } from "./inbox";
import { parseListQuery } from "./list-query";
import { settingsSchema } from "./settings";
import { createEditorSchema, setUserActiveSchema } from "./users";

const validSettings = {
  ministryName: "Demo Ministry",
  contactEmail: "Hello@Example.org",
  taglineNe: " ",
  "social.facebook": "https://facebook.com/demo",
  "social.youtube": "",
  "social.website": "https://example.org",
  donationsEnabled: "on",
};

describe("settingsSchema", () => {
  it("assembles socialLinks in SOCIAL_PLATFORMS order, dropping empties", () => {
    const settings = settingsSchema.parse(validSettings);
    expect(settings.socialLinks).toEqual([
      { platform: "facebook", url: "https://facebook.com/demo" },
      { platform: "website", url: "https://example.org" },
    ]);
    expect(settings.contactEmail).toBe("hello@example.org");
    expect(settings.taglineNe).toBeNull();
    expect(settings.donationsEnabled).toBe(true);
    expect(settings.taxDeductibleVerified).toBe(false);
    expect(settings).not.toHaveProperty("social.facebook");
  });

  it("stores [] when every social input is empty", () => {
    expect(
      settingsSchema.parse({ ministryName: "X", contactEmail: "a@b.org" })
        .socialLinks,
    ).toEqual([]);
  });

  it("accepts only https social links", () => {
    const result = settingsSchema.safeParse({
      ...validSettings,
      "social.instagram": "http://instagram.com/demo",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["social.instagram"]);
    expect(result.error?.issues[0]?.message).toBe(
      "Enter a full link starting with https://",
    );
  });

  it("requires a ministry name and a valid email", () => {
    expect(
      settingsSchema.safeParse({ ...validSettings, ministryName: "" }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...validSettings, contactEmail: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("user and account schemas", () => {
  const editor = {
    name: "Ann",
    email: " Ann@Example.ORG ",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
  };

  it("createEditorSchema normalizes the email", () => {
    expect(createEditorSchema.parse(editor).email).toBe("ann@example.org");
  });

  it("rejects mismatched confirmation and password equal to email", () => {
    const mismatch = createEditorSchema.safeParse({
      ...editor,
      confirmPassword: "something else!",
    });
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmPassword"]);
    const sameAsEmail = createEditorSchema.safeParse({
      ...editor,
      email: "longaddress@example.org",
      password: "LongAddress@Example.org",
      confirmPassword: "LongAddress@Example.org",
    });
    expect(sameAsEmail.error?.issues[0]?.path).toEqual(["password"]);
  });

  it("enforces the password policy", () => {
    expect(
      createEditorSchema.safeParse({
        ...editor,
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("setUserActiveSchema parses the boolean", () => {
    expect(
      setUserActiveSchema.parse({ id: "abc", active: "false" }).active,
    ).toBe(false);
    expect(
      setUserActiveSchema.safeParse({ id: "abc", active: "yes" }).success,
    ).toBe(false);
  });

  it("changePasswordSchema requires matching new passwords", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "new password 123",
        confirmPassword: "new password 124",
      }).success,
    ).toBe(false);
  });
});

describe("auth schemas", () => {
  it("login step 1 normalizes the email and requires a password", () => {
    expect(
      loginStep1Schema.parse({ email: " Bob@Example.ORG ", password: "x" })
        .email,
    ).toBe("bob@example.org");
    expect(
      loginStep1Schema.safeParse({ email: "bob@example.org", password: "" })
        .success,
    ).toBe(false);
  });

  it("TOTP code: 6 digits after removing spaces", () => {
    expect(totpCodeSchema.parse("123 456")).toBe("123456");
    expect(totpCodeSchema.safeParse("12345a").success).toBe(false);
    expect(totpCodeSchema.safeParse("1234567").success).toBe(false);
  });
});

describe("inbox and list query", () => {
  it("prayer status must be a PrayerStatus", () => {
    expect(
      prayerStatusSchema.safeParse({ id: "abc", status: "PRAYED" }).success,
    ).toBe(true);
    expect(
      prayerStatusSchema.safeParse({ id: "abc", status: "READ" }).success,
    ).toBe(false);
  });

  it("parseListQuery is lenient", () => {
    const status = { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED" } as const;
    expect(
      parseListQuery({ q: "  hope ", page: "3", status: "DRAFT" }, { status }),
    ).toEqual({ q: "hope", page: 3, status: "DRAFT" });
    expect(
      parseListQuery(
        { q: "x".repeat(101), page: "-2", status: "NOPE" },
        { status },
      ),
    ).toEqual({ page: 1 });
    expect(parseListQuery({ page: ["2", "5"] })).toEqual({ page: 2 });
  });
});

import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "./errors";
import {
  contactSubmissionSchema,
  formRateLimit,
  prayerSubmissionSchema,
} from "./public-forms";

const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const prayer = (fields: Record<string, string>) =>
  prayerSubmissionSchema.safeParse({
    locale: "en",
    body: "Please pray for my family.",
    turnstileToken: TOKEN,
    ...fields,
  });

const contact = (fields: Record<string, string>) =>
  contactSubmissionSchema.safeParse({
    locale: "en",
    name: "Test Person",
    email: "Person@Example.org",
    kind: "GENERAL",
    subject: "Hello",
    message: "A message.",
    turnstileToken: TOKEN,
    ...fields,
  });

function errors(result: ReturnType<typeof prayer | typeof contact>) {
  expect(result.success).toBe(false);
  return result.success ? {} : fieldErrorsOf(result.error);
}

describe("prayerSubmissionSchema", () => {
  it("parses a normal request with consent off by default", () => {
    const r = prayer({ name: " Sita  Rai ", email: "Sita@Example.org" });
    expect(r.success && r.data).toEqual({
      locale: "en",
      isAnonymous: false,
      name: "Sita Rai",
      email: "sita@example.org",
      body: "Please pray for my family.",
      shareConsent: false,
      turnstileToken: TOKEN,
    });
  });

  it("name and email are optional", () => {
    const r = prayer({ name: "", email: "  " });
    expect(r.success && [r.data.name, r.data.email]).toEqual([null, null]);
  });

  it("anonymous strips name and email, even an invalid email", () => {
    const r = prayer({
      isAnonymous: "on",
      name: "Sita Rai",
      email: "not-an-email",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toMatchObject({
      isAnonymous: true,
      name: null,
      email: null,
    });
  });

  it("rejects an invalid email when not anonymous", () => {
    expect(errors(prayer({ email: "nope" }))).toEqual({
      email: "invalidEmail",
    });
  });

  it("requires a body and checks the limit after sanitizing", () => {
    expect(errors(prayer({ body: "  \u0000 \n " }))).toEqual({
      body: "required",
    });
    expect(errors(prayer({ body: "a".repeat(4001) }))).toEqual({
      body: "tooLong:4000",
    });
    // Control characters do not count towards the limit.
    const r = prayer({ body: `${"a".repeat(4000)}\u0000\u0000` });
    expect(r.success).toBe(true);
  });

  it("keeps consent only when ticked", () => {
    const r = prayer({ shareConsent: "on" });
    expect(r.success && r.data.shareConsent).toBe(true);
  });

  it("falls back to en for an unknown locale", () => {
    const r = prayer({ locale: "fr" });
    expect(r.success && r.data.locale).toBe("en");
  });

  it("requires a Turnstile token of sane length", () => {
    expect(errors(prayer({ turnstileToken: "" }))).toEqual({
      turnstileToken: "turnstileMissing",
    });
    expect(errors(prayer({ turnstileToken: "x".repeat(2049) }))).toEqual({
      turnstileToken: "turnstileMissing",
    });
  });
});

describe("contactSubmissionSchema", () => {
  it("parses a message (email lower-cased, subject single line)", () => {
    const r = contact({ subject: " Hello \n there " });
    expect(r.success && r.data).toMatchObject({
      email: "person@example.org",
      subject: "Hello there",
      message: "A message.",
      shareConsent: false,
    });
  });

  it("forces consent off unless the kind is TESTIMONY", () => {
    for (const kind of ["GENERAL", "VOLUNTEER"]) {
      const r = contact({ kind, shareConsent: "on" });
      expect(r.success && r.data.shareConsent).toBe(false);
    }
    const t = contact({ kind: "TESTIMONY", shareConsent: "on" });
    expect(t.success && t.data.shareConsent).toBe(true);
    const n = contact({ kind: "TESTIMONY" });
    expect(n.success && n.data.shareConsent).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(errors(contact({ kind: "SPAM" }))).toEqual({
      kind: "invalidOption",
    });
  });

  it("requires name, email, subject and message", () => {
    expect(
      errors(contact({ name: " ", email: "", subject: "", message: "" })),
    ).toEqual({
      name: "required",
      email: "required",
      subject: "required",
      message: "required",
    });
  });

  it("enforces the length limits", () => {
    expect(
      errors(
        contact({
          name: "n".repeat(101),
          subject: "s".repeat(151),
          message: "m".repeat(5001),
        }),
      ),
    ).toEqual({
      name: "tooLong:100",
      subject: "tooLong:150",
      message: "tooLong:5000",
    });
  });
});

describe("formRateLimit", () => {
  it("defaults to 5 and accepts 1..1000", () => {
    expect(formRateLimit({})).toBe(5);
    expect(formRateLimit({ FORM_RATE_LIMIT_PER_HOUR: "100" })).toBe(100);
    expect(formRateLimit({ FORM_RATE_LIMIT_PER_HOUR: "1" })).toBe(1);
    for (const bad of ["0", "1001", "-3", "2.5", "abc", ""]) {
      expect(formRateLimit({ FORM_RATE_LIMIT_PER_HOUR: bad }), bad).toBe(5);
    }
  });
});

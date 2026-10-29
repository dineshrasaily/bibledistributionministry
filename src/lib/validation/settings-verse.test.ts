import { describe, expect, it } from "vitest";
import { TIMEZONE_MSG, TRANSLATION_MSG, settingsSchema } from "./settings";

const base = { ministryName: "X", contactEmail: "a@b.org" };

const parse = (extra: Record<string, unknown>) =>
  settingsSchema.safeParse({ ...base, ...extra });

const ok = (extra: Record<string, unknown>) => {
  const result = parse(extra);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
};

const errorOf = (extra: Record<string, unknown>, field: string) => {
  const result = parse(extra);
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path[0] === field)?.message;
};

describe("settingsSchema: verse of the day", () => {
  it("a partial post keeps WEB and New York; the unchecked box is off", () => {
    const data = ok({});
    expect(data.autoVerseTranslation).toBe("WEB");
    expect(data.siteTimezone).toBe("America/New_York");
    expect(data.autoVerseEnabled).toBe(false);
  });

  it("accepts the checkbox, KJV and a valid zone", () => {
    const data = ok({
      autoVerseEnabled: "on",
      autoVerseTranslation: "KJV",
      siteTimezone: " Asia/Kathmandu ",
    });
    expect(data.autoVerseEnabled).toBe(true);
    expect(data.autoVerseTranslation).toBe("KJV");
    expect(data.siteTimezone).toBe("Asia/Kathmandu");
  });

  it("rejects unknown translations", () => {
    expect(
      errorOf({ autoVerseTranslation: "NIV" }, "autoVerseTranslation"),
    ).toBe(TRANSLATION_MSG);
  });

  it("rejects unknown, empty and offset-style time zones", () => {
    for (const tz of ["Mars/Base", "", "UTC+5", "<script>alert(1)</script>"]) {
      expect(errorOf({ siteTimezone: tz }, "siteTimezone"), tz).toBe(
        TIMEZONE_MSG,
      );
    }
  });
});

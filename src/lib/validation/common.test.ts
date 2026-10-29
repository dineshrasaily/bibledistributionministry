import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  checkbox,
  dateOnly,
  emailSchema,
  idSchema,
  isValidAbaRouting,
  isoDateTime,
  optionalEmail,
  optionalSafeUrl,
  optionalText,
  passwordSchema,
  requiredText,
  safeUrl,
  slugSchema,
  toYouTubeEmbed,
  youtubeUrl,
} from "./common";

describe("text helpers", () => {
  it("requiredText trims and rejects empty / over-length", () => {
    expect(requiredText(5).parse("  abc ")).toBe("abc");
    expect(requiredText(5).safeParse("   ").success).toBe(false);
    expect(requiredText(5).safeParse(undefined).success).toBe(false);
    expect(requiredText(5).safeParse("abcdef").success).toBe(false);
  });

  it("optionalText turns empty/whitespace/missing into null", () => {
    expect(optionalText(10).parse("")).toBeNull();
    expect(optionalText(10).parse("   ")).toBeNull();
    expect(optionalText(10).parse(undefined)).toBeNull();
    expect(optionalText(10).parse(" नमस्ते ")).toBe("नमस्ते");
    expect(optionalText(3).safeParse("abcd").success).toBe(false);
  });
});

describe("slugSchema", () => {
  it("accepts lowercase hyphenated slugs (lower-casing input)", () => {
    expect(slugSchema.parse(" My-Post-1 ")).toBe("my-post-1");
  });

  it.each(["", "a--b", "-a", "a-", "a b", "ünï", "a_b", "x".repeat(121)])(
    "rejects %j",
    (value) => {
      expect(slugSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("safeUrl", () => {
  it.each(["https://example.org/a.jpg", "/images/a.jpg", "/"])(
    "accepts %s",
    (value) => {
      expect(safeUrl().safeParse(value).success).toBe(true);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "http://example.org/a.jpg",
    "//evil.com/a.jpg",
    "ftp://example.org",
    "not a url",
  ])("rejects %s", (value) => {
    expect(safeUrl().safeParse(value).success).toBe(false);
  });

  it("optional variant maps blank to null", () => {
    expect(optionalSafeUrl().parse("")).toBeNull();
    expect(optionalSafeUrl().parse(undefined)).toBeNull();
    expect(optionalSafeUrl().safeParse("javascript:x").success).toBe(false);
  });
});

describe("youtubeUrl", () => {
  const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";

  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("normalizes %s to the nocookie embed", (value) => {
    expect(youtubeUrl.parse(value)).toBe(embed);
  });

  it.each([
    "https://vimeo.com/123456",
    "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "javascript:alert(1)",
  ])("rejects %s", (value) => {
    expect(toYouTubeEmbed(value)).toBeNull();
    const result = youtubeUrl.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Enter a YouTube link (youtube.com or youtu.be).",
    );
  });
});

describe("dates, checkbox, id", () => {
  it("isoDateTime requires an offset and returns a Date", () => {
    expect(isoDateTime.parse("2026-05-01T10:00:00+05:45")).toEqual(
      new Date("2026-05-01T04:15:00Z"),
    );
    expect(isoDateTime.parse("2026-05-01T10:00:00Z")).toBeInstanceOf(Date);
    expect(isoDateTime.safeParse("2026-05-01T10:00").success).toBe(false);
  });

  it("dateOnly returns UTC midnight", () => {
    expect(dateOnly.parse("2026-01-01").toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(dateOnly.safeParse("2026-13-01").success).toBe(false);
  });

  it("checkbox maps on/true to true and missing to false", () => {
    const schema = z.object({ flag: checkbox() });
    expect(schema.parse({ flag: "on" }).flag).toBe(true);
    expect(schema.parse({ flag: "true" }).flag).toBe(true);
    expect(schema.parse({}).flag).toBe(false);
  });

  it("idSchema accepts cuids and demo ids only", () => {
    expect(idSchema.safeParse("cmabc123def456ghi789jkl0").success).toBe(true);
    expect(idSchema.safeParse("isaiah-6-8").success).toBe(true);
    expect(idSchema.safeParse("../etc").success).toBe(false);
    expect(idSchema.safeParse("").success).toBe(false);
  });
});

describe("emailSchema and passwordSchema", () => {
  it('normalizes " Bob@Example.ORG " to "bob@example.org"', () => {
    expect(emailSchema.parse(" Bob@Example.ORG ")).toBe("bob@example.org");
  });

  it("rejects invalid and over-long emails", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(
      emailSchema.safeParse(`${"a".repeat(250)}@example.org`).success,
    ).toBe(false);
  });

  it("password policy is 12..128 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
  });
});

describe("isValidAbaRouting", () => {
  it("accepts real routing numbers (checksum ok)", () => {
    for (const n of ["011000015", "021000021", "121000358"]) {
      expect(isValidAbaRouting(n), n).toBe(true);
    }
  });
  it("rejects bad checksums, wrong lengths and non-digits", () => {
    for (const n of [
      "011000016",
      "123456789",
      "12345678",
      "0210000210",
      "02100002a",
      "",
    ]) {
      expect(isValidAbaRouting(n), n).toBe(false);
    }
  });
});

describe("optionalEmail", () => {
  it("blank -> null, otherwise trimmed + lower-cased", () => {
    expect(optionalEmail().parse("")).toBeNull();
    expect(optionalEmail().parse("   ")).toBeNull();
    expect(optionalEmail().parse(undefined)).toBeNull();
    expect(optionalEmail().parse(" Give@Example.org ")).toBe(
      "give@example.org",
    );
    expect(optionalEmail().safeParse("not-an-email").success).toBe(false);
  });
});

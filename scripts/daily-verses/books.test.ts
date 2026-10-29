// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BOOKS, formatReference, parseReference } from "./books";

describe("books", () => {
  it("has the 66 canonical books with unique codes", () => {
    expect(BOOKS).toHaveLength(66);
    expect(new Set(BOOKS.map((b) => b.vpl)).size).toBe(66);
    expect(new Set(BOOKS.map((b) => b.usfm)).size).toBe(66);
  });

  it("parses and formats single verses and ranges (round trip)", () => {
    for (const ref of [
      "John 3:16",
      "Psalm 23:1",
      "1 Corinthians 13:4-7",
      "Song of Solomon 8:7",
      "Jude 1:24-25",
    ]) {
      expect(formatReference(parseReference(ref))).toBe(ref);
    }
    expect(parseReference("1 Corinthians 13:4-7")).toEqual({
      book: "1 Corinthians",
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
    });
  });

  it('uses "Psalm" (singular) for one psalm and the book "Psalms"', () => {
    expect(parseReference("Psalm 23:1").book).toBe("Psalms");
    expect(() => parseReference("Psalms 23:1")).toThrow(/Psalm/);
  });

  it("rejects unknown books, cross-chapter and backwards ranges", () => {
    expect(() => parseReference("Hezekiah 1:1")).toThrow(/Unknown book/);
    expect(() => parseReference("John 3:16-4:2")).toThrow(/format/);
    expect(() => parseReference("John 3:16-15")).toThrow(/range/);
    expect(() => parseReference("John 3:16-16")).toThrow(/two or more/);
    expect(() => parseReference("John 3")).toThrow(/format/);
  });
});

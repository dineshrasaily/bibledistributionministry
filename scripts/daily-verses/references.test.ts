// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateCurated } from "../build-daily-verses";
import { parseReference } from "./books";
import { consecutiveSameBook, orderForDays } from "./order";
import { CURATED_REFERENCES, LONG_RANGE_ALLOW_LIST } from "./references";

const r = (reference: string) => ({ reference });

describe("curated references", () => {
  it("has exactly 366 unique, parseable references", () => {
    expect(CURATED_REFERENCES).toHaveLength(366);
    const refs = CURATED_REFERENCES.map((c) => c.reference);
    expect(new Set(refs).size).toBe(366);
    for (const ref of refs) expect(() => parseReference(ref)).not.toThrow();
  });

  it("passes the generator's rules (no overlaps, at most 3 verses)", () => {
    expect(validateCurated(CURATED_REFERENCES)).toEqual([]);
    for (const { reference } of CURATED_REFERENCES) {
      const p = parseReference(reference);
      const count = p.verseEnd - p.verseStart + 1;
      if (count > 3) expect(LONG_RANGE_ALLOW_LIST).toContain(reference);
    }
  });

  it("includes the verses the accuracy tests spot-check", () => {
    const refs = new Set(CURATED_REFERENCES.map((c) => c.reference));
    for (const ref of [
      "John 3:16",
      "Psalm 23:1",
      "Philippians 4:13",
      "Jeremiah 29:11",
      "Proverbs 3:5",
      "Isaiah 40:31",
      "Romans 8:28",
      "2 Corinthians 5:17",
      "Matthew 11:28",
      "Psalm 23:4",
      "1 Corinthians 13:4-7",
      "Joshua 1:9",
    ]) {
      expect(refs.has(ref), ref).toBe(true);
    }
  });

  it("is a broad mix of books", () => {
    const books = CURATED_REFERENCES.map(
      (c) => parseReference(c.reference).book,
    );
    const share = (name: string) =>
      books.filter((b) => b === name).length / books.length;
    expect(new Set(books).size).toBeGreaterThan(40);
    expect(share("Psalms")).toBeLessThan(0.3);
    for (const book of ["Proverbs", "Isaiah", "John", "Romans", "Matthew"]) {
      expect(share(book), book).toBeGreaterThan(0.01);
    }
  });
});

describe("validateCurated", () => {
  it("reports duplicates, overlaps, long ranges and bad references", () => {
    const errors = validateCurated([
      r("John 3:16"),
      r("John 3:16"),
      r("Romans 8:28"),
      r("Romans 8:27-29"),
      r("Psalm 1:1-5"),
      r("Hezekiah 1:1"),
    ]);
    const text = errors.join("\n");
    expect(text).toMatch(/Expected 366/);
    expect(text).toMatch(/Duplicate: John 3:16/);
    expect(text).toMatch(/Overlap: Romans 8:27-29 and Romans 8:28/);
    expect(text).toMatch(/More than 3 verses: Psalm 1:1-5/);
    expect(text).toMatch(/Unknown book/);
  });
});

describe("orderForDays", () => {
  it("keeps every entry and never puts one book on two consecutive days", () => {
    const ordered = orderForDays(CURATED_REFERENCES);
    expect(ordered.map((o) => o.reference).sort()).toEqual(
      CURATED_REFERENCES.map((c) => c.reference).sort(),
    );
    const books = ordered.map((o) => ({
      book: parseReference(o.reference).book,
    }));
    expect(consecutiveSameBook(books)).toEqual([]);
  });

  it("is deterministic", () => {
    expect(orderForDays(CURATED_REFERENCES)).toEqual(
      orderForDays(CURATED_REFERENCES),
    );
  });
});

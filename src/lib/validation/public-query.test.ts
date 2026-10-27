import { describe, expect, it } from "vitest";
import {
  hasPublicPostFilters,
  parsePublicPostQuery,
  publicPostQueryHref,
} from "./public-query";

describe("parsePublicPostQuery", () => {
  it("parses valid params", () => {
    expect(
      parsePublicPostQuery({
        q: "  shepherd ",
        type: "DEVOTIONAL",
        category: "faith-and-prayer",
        page: "2",
      }),
    ).toEqual({
      q: "shepherd",
      type: "DEVOTIONAL",
      category: "faith-and-prayer",
      page: 2,
    });
  });

  it("drops invalid values instead of throwing", () => {
    expect(
      parsePublicPostQuery({
        q: "x".repeat(101),
        type: "NOPE",
        category: "Not A Slug!",
        page: "-3",
      }),
    ).toEqual({ page: 1 });
    expect(parsePublicPostQuery({ page: "abc" })).toEqual({ page: 1 });
    expect(parsePublicPostQuery({ page: "1.5" })).toEqual({ page: 1 });
    expect(parsePublicPostQuery({ q: "   " })).toEqual({ page: 1 });
    expect(parsePublicPostQuery({})).toEqual({ page: 1 });
  });

  it("uses the first value of repeated params", () => {
    expect(
      parsePublicPostQuery({ type: ["ARTICLE", "DEVOTIONAL"], page: ["3"] }),
    ).toEqual({ type: "ARTICLE", page: 3 });
  });

  it("keeps Devanagari search text", () => {
    expect(parsePublicPostQuery({ q: "भजनसंग्रह" }).q).toBe("भजनसंग्रह");
  });

  it("reports whether a filter is active", () => {
    expect(hasPublicPostFilters({ page: 3 })).toBe(false);
    expect(hasPublicPostFilters({ page: 1, q: "x" })).toBe(true);
  });
});

describe("publicPostQueryHref", () => {
  const base = "/en/devotionals";

  it("omits empty params and page 1", () => {
    expect(publicPostQueryHref(base, { page: 1 })).toBe(base);
    expect(publicPostQueryHref(base, { page: 1, q: "a b&c" })).toBe(
      `${base}?q=a+b%26c`,
    );
  });

  it("keeps the other params when changing page", () => {
    expect(
      publicPostQueryHref(
        base,
        { q: "x", type: "ARTICLE", page: 1 },
        { page: 2 },
      ),
    ).toBe(`${base}?q=x&type=ARTICLE&page=2`);
  });

  it("resets the page when a filter changes", () => {
    expect(
      publicPostQueryHref(
        base,
        { type: "ARTICLE", page: 3 },
        { category: "faith-and-prayer" },
      ),
    ).toBe(`${base}?type=ARTICLE&category=faith-and-prayer`);
    expect(
      publicPostQueryHref(
        base,
        { type: "ARTICLE", page: 3 },
        { type: undefined },
      ),
    ).toBe(base);
  });
});

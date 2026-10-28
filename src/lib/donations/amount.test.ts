import { describe, expect, it } from "vitest";
import {
  DONATION_PRESETS_USD,
  formatPresetUsd,
  formatUsd,
  MAX_CENTS,
  MIN_CENTS,
  parseUsdToCents,
} from "./amount";

describe("parseUsdToCents", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["25.50", 2550],
    ["$1,000", 100_000],
    ["$ 12.34", 1234],
    [" 5 ", 500],
    ["19.99", 1999],
    ["0.29", 29],
    ["10000", 1_000_000],
    ["10,000.00", 1_000_000],
  ])("%j -> %i cents (integer exact)", (input, cents) => {
    expect(parseUsdToCents(input)).toBe(cents);
  });

  it("returns values outside the limits so the schema can say why", () => {
    expect(parseUsdToCents("4.99")).toBe(499);
    expect(parseUsdToCents("4.99")! < MIN_CENTS).toBe(true);
    expect(parseUsdToCents("10000.01")).toBe(1_000_001);
    expect(parseUsdToCents("10000.01")! > MAX_CENTS).toBe(true);
  });

  it.each([
    "abc",
    "1e3",
    "-5",
    "+5",
    "5.555",
    "",
    "  ",
    "1234567",
    "123456",
    "5.",
    ".5",
    "1,0,0",
    "10,00",
    "$$5",
    "5 5",
    "0x10",
    "Infinity",
    "NaN",
    "５",
  ])("%j -> null", (input) => {
    expect(parseUsdToCents(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(parseUsdToCents(25)).toBeNull();
    expect(parseUsdToCents(null)).toBeNull();
    expect(parseUsdToCents(undefined)).toBeNull();
  });

  it("presets are inside the limits", () => {
    for (const usd of DONATION_PRESETS_USD) {
      expect(usd * 100).toBeGreaterThanOrEqual(MIN_CENTS);
      expect(usd * 100).toBeLessThanOrEqual(MAX_CENTS);
    }
  });
});

describe("formatUsd", () => {
  it("formats cents as US dollars", () => {
    expect(formatUsd(2500, "en")).toBe("$25.00");
    expect(formatUsd(123_456, "en")).toBe("$1,234.56");
    expect(formatPresetUsd(25, "en")).toBe("$25");
  });

  it("uses the Nepali locale but still US dollars", () => {
    const ne = formatUsd(2500, "ne");
    expect(ne).toMatch(/US\$|\$/);
    expect(ne).not.toBe("");
  });
});

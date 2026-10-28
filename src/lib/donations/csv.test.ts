import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes every cell and doubles quotes", () => {
    expect(csvCell("plain")).toBe('"plain"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a,b\nc")).toBe('"a,b\nc"');
    expect(csvCell(12.5)).toBe('"12.5"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });

  it.each([
    ["=SUM(1)", `"'=SUM(1)"`],
    ["+1", `"'+1"`],
    ["-2", `"'-2"`],
    ["@x", `"'@x"`],
    ["\tcmd", `"'\tcmd"`],
    ["\rX", `"'\rX"`],
    ['=HYPERLINK("x")@example.org', `"'=HYPERLINK(""x"")@example.org"`],
  ])("prefixes formula-like %j with an apostrophe", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("leaves ordinary emails and ids alone", () => {
    expect(csvCell("donor@example.org")).toBe('"donor@example.org"');
    expect(csvCell("pi_test_123")).toBe('"pi_test_123"');
  });
});

describe("toCsv", () => {
  it("adds a BOM and uses CRLF line endings", () => {
    const csv = toCsv([
      ["A", "B"],
      ["1", null],
    ]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}"A","B"\r\n"1",""\r\n`);
  });
});

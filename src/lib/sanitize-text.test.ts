import { describe, expect, it } from "vitest";
import { sanitizePlainText, sanitizeSingleLine } from "./sanitize-text";

describe("sanitizePlainText", () => {
  it("removes control characters but keeps newlines and tabs", () => {
    expect(sanitizePlainText("a\u0000b\u0007c\td\ne\u009F")).toBe("abc\td\ne");
  });

  it("removes bidi overrides, isolates, zero-width space and BOM", () => {
    expect(
      sanitizePlainText("\uFEFFsafe\u202Etxt.exe\u2066x\u2069\u200By"),
    ).toBe("safetxt.exexy");
  });

  it("keeps ZWJ/ZWNJ in Devanagari", () => {
    const text = "क्\u200Dष र्\u200Cय प्रार्थना";
    expect(sanitizePlainText(text)).toBe(text);
  });

  it("normalizes to NFC", () => {
    expect(sanitizePlainText("e\u0301")).toBe("\u00E9");
  });

  it("turns CRLF and CR into LF and collapses 3+ blank lines", () => {
    expect(sanitizePlainText("one\r\ntwo\rthree\n\n\n\n\nfour")).toBe(
      "one\ntwo\nthree\n\nfour",
    );
  });

  it("trims and drops trailing spaces on lines", () => {
    expect(sanitizePlainText("  hello   \nworld  ")).toBe("hello\nworld");
  });

  it("keeps HTML-looking text literally (rendered as text only)", () => {
    expect(sanitizePlainText("<b>bold</b> <3 a < b")).toBe(
      "<b>bold</b> <3 a < b",
    );
  });
});

describe("sanitizeSingleLine", () => {
  it("collapses newlines and runs of whitespace", () => {
    expect(sanitizeSingleLine("  Ram \n\n  Bahadur\t Thapa ")).toBe(
      "Ram Bahadur Thapa",
    );
  });
});

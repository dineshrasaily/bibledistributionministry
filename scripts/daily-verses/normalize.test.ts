// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  balanceDoubleQuotes,
  normalizeEntry,
  normalizeVerseText,
} from "./normalize";

describe("normalizeVerseText", () => {
  it("drops ¶, unwraps KJV italics and collapses whitespace", () => {
    expect(
      normalizeVerseText(
        "¶ Come unto me, all [ye] that labour  and are heavy laden,\n and I will give you rest.",
      ),
    ).toBe(
      "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    );
    expect(normalizeVerseText("The LORD [is] my shepherd; ")).toBe(
      "The LORD is my shepherd;",
    );
  });
});

describe("balanceDoubleQuotes", () => {
  it("opens a quote that closes before it opens (Jeremiah 29:11 shape)", () => {
    expect(
      balanceDoubleQuotes("For I know you,” says Yahweh, “thoughts of peace."),
    ).toBe("“For I know you,” says Yahweh, “thoughts of peace.”");
  });

  it("closes a quote left open (Matthew 11:28 shape)", () => {
    expect(balanceDoubleQuotes("“Come to me, and I will give you rest.")).toBe(
      "“Come to me, and I will give you rest.”",
    );
  });

  it("leaves balanced text and apostrophes alone", () => {
    const text = "“Don’t be afraid,” he said.";
    expect(balanceDoubleQuotes(text)).toBe(text);
  });
});

describe("normalizeEntry", () => {
  it("joins the verses of a range with one space", () => {
    expect(normalizeEntry(["First verse. ", " Second verse."])).toBe(
      "First verse. Second verse.",
    );
  });

  it("strips an exact psalm title and fails when it does not match", () => {
    expect(
      normalizeEntry(
        ["A Psalm of David. The LORD [is] my shepherd; I shall not want."],
        "A Psalm of David. ",
      ),
    ).toBe("The LORD is my shepherd; I shall not want.");
    expect(() =>
      normalizeEntry(["By David. Yahweh is my light."], "A Psalm by David. "),
    ).toThrow(/expected title/);
  });

  it("fails on empty text and on leftover markers", () => {
    expect(() => normalizeEntry(["   "])).toThrow(/Empty/);
    expect(() => normalizeEntry(["text with \\w marker"])).toThrow(/marker/);
    expect(() => normalizeEntry(["unclosed [bracket"])).toThrow(/marker/);
  });
});

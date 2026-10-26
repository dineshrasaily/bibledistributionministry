import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ne from "../../messages/ne.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") acc[path] = value;
      else Object.assign(acc, flatten(value, path));
      return acc;
    },
    {},
  );
}

const flatEn = flatten(en as Tree);
const { _note, ...neRest } = ne as Tree & { _note?: string };
const flatNe = flatten(neRest as Tree);
const forbidden = /tax[- ]deductible|501\(c\)|registered charity/i;

describe("message files", () => {
  it("en and ne have identical keys (ignoring _note)", () => {
    expect(Object.keys(flatNe).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it("ne carries a top-level review note", () => {
    expect(typeof _note).toBe("string");
    expect(_note).toMatch(/native/i);
  });

  it("has no empty values", () => {
    for (const [key, value] of Object.entries({ ...flatEn, ...flatNe })) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("does not hard-code the ministry name or make tax/charity claims", () => {
    for (const file of [JSON.stringify(en), JSON.stringify(ne)]) {
      expect(file).not.toContain("Demo Ministry");
      expect(file).not.toMatch(forbidden);
    }
  });
});

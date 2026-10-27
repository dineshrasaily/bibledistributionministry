import { describe, expect, it } from "vitest";
import { findPersonalInfo } from "./pii";

describe("findPersonalInfo", () => {
  it("finds email addresses", () => {
    expect(findPersonalInfo("write to me at a.b@example.org please")).toEqual([
      "email",
    ]);
  });

  it("finds phone numbers in common formats", () => {
    expect(findPersonalInfo("call +977 98-1234-5678")).toEqual(["phone"]);
    expect(findPersonalInfo("call (555) 123.4567")).toEqual(["phone"]);
    expect(findPersonalInfo("फोन ९८४१२३४५६७ मा")).toEqual(["phone"]);
  });

  it("ignores short numbers such as verse references", () => {
    expect(findPersonalInfo("Psalm 23:1-6 and John 3:16")).toEqual([]);
  });

  it("finds name words case-insensitively as whole words", () => {
    const who = { name: "Sita Rai", email: "sita.rai@example.org" };
    expect(findPersonalInfo("Pray for SITA and her family", who)).toEqual([
      "name",
    ]);
    // "Rai" is a 3-letter word; "rain" must not match it.
    expect(findPersonalInfo("Pray for rain this season", who)).toEqual([]);
    expect(findPersonalInfo("Pray for Rai's family", who)).toEqual(["name"]);
  });

  it("uses the email local part and ignores words under 3 letters", () => {
    expect(
      findPersonalInfo("thanks prabin", { email: "prabin77@example.org" }),
    ).toEqual(["name"]);
    expect(findPersonalInfo("go to Al", { name: "Al" })).toEqual([]);
  });

  it("matches Devanagari names", () => {
    expect(findPersonalInfo("सीता लागि प्रार्थना", { name: "सीता" })).toEqual([
      "name",
    ]);
  });

  it("passes clean text", () => {
    expect(
      findPersonalInfo("Please pray for healing and peace for a family.", {
        name: "Test Person",
        email: "person@example.org",
      }),
    ).toEqual([]);
  });
});

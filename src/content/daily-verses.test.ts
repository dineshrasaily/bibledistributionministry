// @vitest-environment node
import { statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DAILY_VERSES } from "./daily-verses";

const REF_RE = /^(.+?) (\d+):(\d+)(?:-(\d+))?$/;

describe("daily verses data file", () => {
  it("has 366 unique references with non-empty KJV and WEB text", () => {
    expect(DAILY_VERSES).toHaveLength(366);
    expect(new Set(DAILY_VERSES.map((v) => v.reference)).size).toBe(366);
    for (const v of DAILY_VERSES) {
      expect(v.kjv.trim(), v.reference).not.toBe("");
      expect(v.web.trim(), v.reference).not.toBe("");
      expect(v.kjv, v.reference).toBe(v.kjv.trim());
      expect(v.web, v.reference).toBe(v.web.trim());
    }
  });

  it("contains no footnote, Strong's, italics or paragraph markers", () => {
    for (const v of DAILY_VERSES) {
      for (const text of [v.kjv, v.web]) {
        expect(text, v.reference).not.toMatch(/[[\]\\<>{}|¶]|\s{2}/);
        expect(text, v.reference).not.toMatch(/strong=|\bH\d{3,4}\b|G\d{3,4}/);
      }
    }
  });

  it("references are well formed and agree with the structured fields", () => {
    for (const v of DAILY_VERSES) {
      const m = REF_RE.exec(v.reference);
      expect(m, v.reference).not.toBeNull();
      const name = v.book === "Psalms" ? "Psalm" : v.book;
      expect(m![1]).toBe(name);
      expect(Number(m![2])).toBe(v.chapter);
      expect(Number(m![3])).toBe(v.verseStart);
      expect(Number(m![4] ?? m![3])).toBe(v.verseEnd);
    }
  });

  it("never shows a psalm title or the same book on two consecutive days", () => {
    for (const v of DAILY_VERSES.filter(
      (x) => x.book === "Psalms" && x.verseStart === 1,
    )) {
      expect(v.kjv).not.toMatch(/^(A Psalm|A Song|To the chief|Of David)/i);
      expect(v.web).not.toMatch(/^(A Psalm|A Song|For the Chief|By David)/i);
    }
    for (let i = 1; i < DAILY_VERSES.length; i++) {
      expect(DAILY_VERSES[i]!.book, `day ${i}`).not.toBe(
        DAILY_VERSES[i - 1]!.book,
      );
    }
  });

  it("is a small committed file (under 500 KB)", () => {
    const file = path.join(process.cwd(), "src/content/daily-verses.ts");
    expect(statSync(file).size).toBeLessThan(500 * 1024);
  });
});

/**
 * Exact text, copied from the eBible.org source files (eng-kjv2006 VPL and
 * eng-web VPL, after normalization) and cross-checked against eng-kjv VPL,
 * eng-web USFM and, for KJV, bible-api.com (see the verse-of-day
 * verification note).
 */
const SPOT_CHECKS: { reference: string; kjv: string; web: string }[] = [
  {
    reference: "John 3:16",
    kjv: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    web: "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.",
  },
  {
    reference: "Psalm 23:1",
    kjv: "The LORD is my shepherd; I shall not want.",
    web: "Yahweh is my shepherd; I shall lack nothing.",
  },
  {
    reference: "Psalm 23:4",
    kjv: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
    web: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.",
  },
  {
    reference: "Philippians 4:13",
    kjv: "I can do all things through Christ which strengtheneth me.",
    web: "I can do all things through Christ who strengthens me.",
  },
  {
    reference: "Jeremiah 29:11",
    kjv: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.",
    web: "“For I know the thoughts that I think toward you,” says Yahweh, “thoughts of peace, and not of evil, to give you hope and a future.”",
  },
  {
    reference: "Proverbs 3:5",
    kjv: "Trust in the LORD with all thine heart; and lean not unto thine own understanding.",
    web: "Trust in Yahweh with all your heart, and don’t lean on your own understanding.",
  },
  {
    reference: "Isaiah 40:31",
    kjv: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
    web: "but those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.",
  },
  {
    reference: "Romans 8:28",
    kjv: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
    web: "We know that all things work together for good for those who love God, for those who are called according to his purpose.",
  },
  {
    reference: "2 Corinthians 5:17",
    kjv: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.",
    web: "Therefore if anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new.",
  },
  {
    reference: "Matthew 11:28",
    kjv: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    web: "“Come to me, all you who labor and are heavily burdened, and I will give you rest.”",
  },
  {
    reference: "1 Corinthians 13:4-7",
    kjv: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil; Rejoiceth not in iniquity, but rejoiceth in the truth; Beareth all things, believeth all things, hopeth all things, endureth all things.",
    web: "Love is patient and is kind. Love doesn’t envy. Love doesn’t brag, is not proud, doesn’t behave itself inappropriately, doesn’t seek its own way, is not provoked, takes no account of evil; doesn’t rejoice in unrighteousness, but rejoices with the truth; bears all things, believes all things, hopes all things, and endures all things.",
  },
  {
    reference: "Joshua 1:9",
    kjv: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    web: "“Haven’t I commanded you? Be strong and courageous. Don’t be afraid. Don’t be dismayed, for Yahweh your God is with you wherever you go.”",
  },
  {
    reference: "Psalm 46:1",
    kjv: "God is our refuge and strength, a very present help in trouble.",
    web: "God is our refuge and strength, a very present help in trouble.",
  },
];

describe("exact verse text (spot checks)", () => {
  it.each(SPOT_CHECKS)("$reference", ({ reference, kjv, web }) => {
    const verse = DAILY_VERSES.find((v) => v.reference === reference);
    expect(verse, reference).toBeDefined();
    expect(verse!.kjv).toBe(kjv);
    expect(verse!.web).toBe(web);
  });
});

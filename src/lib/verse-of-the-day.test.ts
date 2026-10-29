// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DAILY_VERSES } from "@/content/daily-verses";
import {
  dayOfYearIndex,
  getVerseOfTheDay,
  siteDay,
  toAutoVerseView,
} from "./verse-of-the-day";

const NY = "America/New_York";
const KTM = "Asia/Kathmandu";

describe("siteDay", () => {
  it("uses the calendar date in the given time zone", () => {
    // 03:30 UTC = 23:30 on Mar 9 in New York (EDT) = 09:15 on Mar 10 in Nepal.
    const now = new Date("2026-03-10T03:30:00.000Z");
    expect(siteDay(now, NY).iso).toBe("2026-03-09");
    expect(siteDay(now, KTM).iso).toBe("2026-03-10");
    expect(siteDay(now, "UTC").iso).toBe("2026-03-10");
    expect(siteDay(now, NY).utcDate.toISOString()).toBe(
      "2026-03-09T00:00:00.000Z",
    );
  });

  it("falls back to New York for an invalid time zone", () => {
    const now = new Date("2026-03-10T03:30:00.000Z");
    expect(siteDay(now, "Mars/Base").iso).toBe("2026-03-09");
    expect(siteDay(now, "").iso).toBe("2026-03-09");
  });
});

describe("dayOfYearIndex (leap-year slots)", () => {
  it("maps Jan 1, Feb 29, Mar 1 and Dec 31", () => {
    expect(dayOfYearIndex(1, 1)).toBe(0);
    expect(dayOfYearIndex(2, 28)).toBe(58);
    expect(dayOfYearIndex(2, 29)).toBe(59);
    expect(dayOfYearIndex(3, 1)).toBe(60);
    expect(dayOfYearIndex(12, 31)).toBe(365);
  });
});

describe("getVerseOfTheDay", () => {
  const at = (iso: string, tz = "UTC") => getVerseOfTheDay(new Date(iso), tz);

  it("23:30 in New York and the next morning in Kathmandu pick different days", () => {
    const now = new Date("2026-03-10T03:30:00.000Z");
    const ny = getVerseOfTheDay(now, NY);
    const ktm = getVerseOfTheDay(now, KTM);
    expect(ny.index).toBe(dayOfYearIndex(3, 9));
    expect(ktm.index).toBe(dayOfYearIndex(3, 10));
    expect(ny.index).toBe(68);
    expect(ktm.index).toBe(69);
    expect(ny.verse.reference).not.toBe(ktm.verse.reference);
  });

  it("Jan 1 is slot 0 and Dec 31 is slot 365 in leap and non-leap years", () => {
    for (const year of [2027, 2028]) {
      expect(at(`${year}-01-01T12:00:00Z`).index).toBe(0);
      expect(at(`${year}-12-31T12:00:00Z`).index).toBe(365);
      expect(at(`${year}-12-31T12:00:00Z`).verse).toBe(DAILY_VERSES[365]);
    }
  });

  it("Feb 29 uses slot 59; Mar 1 is slot 60 every year; non-leap years skip 59", () => {
    expect(at("2028-02-29T12:00:00Z").index).toBe(59);
    expect(at("2027-03-01T12:00:00Z").index).toBe(60);
    expect(at("2028-03-01T12:00:00Z").index).toBe(60);
    const used = new Set<number>();
    for (let t = Date.UTC(2027, 0, 1, 12); t < Date.UTC(2028, 0, 1);) {
      used.add(at(new Date(t).toISOString()).index);
      t += 86_400_000;
    }
    expect(used.size).toBe(365);
    expect(used.has(59)).toBe(false);
  });

  it("every leap-year day gets a different verse", () => {
    const refs = new Set<string>();
    for (let t = Date.UTC(2028, 0, 1, 12); t < Date.UTC(2029, 0, 1);) {
      refs.add(at(new Date(t).toISOString()).verse.reference);
      t += 86_400_000;
    }
    expect(refs.size).toBe(366);
  });

  it("is the same all day and changes at midnight in the site time zone", () => {
    // New York, Jun 15 2026 (EDT, UTC-4): 00:01 .. 23:59 local.
    const morning = at("2026-06-15T04:01:00Z", NY);
    const night = at("2026-06-16T03:59:00Z", NY);
    const next = at("2026-06-16T04:01:00Z", NY);
    expect(night.verse).toBe(morning.verse);
    expect(next.verse).not.toBe(morning.verse);
    expect(next.index).toBe(morning.index + 1);
  });

  it("invalid time zones fall back to the default instead of throwing", () => {
    const now = new Date("2026-03-10T03:30:00.000Z");
    expect(getVerseOfTheDay(now, "<script>").index).toBe(
      getVerseOfTheDay(now, NY).index,
    );
  });
});

describe("toAutoVerseView", () => {
  const verse = DAILY_VERSES.find((v) => v.reference === "John 3:16")!;

  it("WEB and KJV text with the matching translation, never demo", () => {
    const web = toAutoVerseView(verse, 7, "WEB");
    expect(web).toEqual({
      id: "auto-7",
      reference: "John 3:16",
      translation: "WEB",
      text: verse.web,
      isDemo: false,
    });
    const kjv = toAutoVerseView(verse, 7, "KJV");
    expect(kjv.translation).toBe("KJV");
    expect(kjv.text).toBe(verse.kjv);
    expect(kjv.isDemo).toBe(false);
  });
});

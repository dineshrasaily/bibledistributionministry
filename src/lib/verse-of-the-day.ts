/**
 * Automatic "verse of the day": a pure, deterministic pick from the curated
 * list in src/content/daily-verses.ts by the calendar day in the site time
 * zone. Every visitor sees the same verse on the same day; it changes at
 * midnight in that zone.
 *
 * Day slots follow a leap-year calendar: Jan 1 = 0, Feb 29 = 59,
 * Mar 1 = 60, Dec 31 = 365. In non-leap years Feb 29 (slot 59) is simply
 * skipped, so each calendar date always maps to the same verse.
 *
 * Pure module with relative imports only (e2e specs import it too).
 */
import { DAILY_VERSES, type DailyVerse } from "../content/daily-verses";
import { DEFAULT_SITE_TIME_ZONE, isValidTimeZone } from "../config/time-zones";
import type { VerseView } from "./content-mappers";

export type AutoVerseTranslation = "WEB" | "KJV";

export type SiteDay = {
  y: number;
  m: number;
  d: number;
  /** "YYYY-MM-DD" */
  iso: string;
  /** UTC midnight of that calendar date (the BibleVerse.featuredOn key). */
  utcDate: Date;
};

/** The calendar date of `now` in `timeZone` (invalid zones use the default). */
export function siteDay(now: Date, timeZone: string): SiteDay {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_SITE_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { y, m, d, iso, utcDate: new Date(Date.UTC(y, m - 1, d)) };
}

// Days before each month in a leap year.
const LEAP_MONTH_OFFSETS = [
  0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335,
];

/** Slot 0..365 of a month (1-12) and day in the leap-year calendar. */
export function dayOfYearIndex(month: number, day: number): number {
  return LEAP_MONTH_OFFSETS[month - 1]! + day - 1;
}

/** The curated verse for `date` in `timeZone`, with its slot index. */
export function getVerseOfTheDay(
  date: Date,
  timeZone: string,
): { index: number; verse: DailyVerse; day: SiteDay } {
  const day = siteDay(date, timeZone);
  const index = dayOfYearIndex(day.m, day.d) % DAILY_VERSES.length;
  return { index, verse: DAILY_VERSES[index]!, day };
}

/** A curated verse as the VerseView the public pages render. */
export function toAutoVerseView(
  verse: DailyVerse,
  index: number,
  translation: AutoVerseTranslation,
): VerseView {
  return {
    id: `auto-${index}`,
    reference: verse.reference,
    translation,
    text: translation === "KJV" ? verse.kjv : verse.web,
    // Real Scripture, never demo content.
    isDemo: false,
  };
}

import { beforeEach, describe, expect, it } from "vitest";
import { demoEvents } from "@/content/demo/events";
import { demoMedia } from "@/content/demo/media";
import { demoPosts } from "@/content/demo/posts";
import { demoVerses } from "@/content/demo/verses";
import { resetDb } from "@/test/db-setup";
import { makeEvent, makeMedia, makePost, makeVerse } from "@/test/factories";
import { seedDemoContent } from "../../prisma/seed-lib";
import {
  getFeaturedContent,
  getFeaturedVerse,
  getRecentUpdates,
  getUpcomingEvents,
  getVerseById,
} from "./content";
import { prisma } from "./db";

const isSortedDesc = (dates: string[]) =>
  dates.every((d, i) => i === 0 || Date.parse(dates[i - 1]!) >= Date.parse(d));
const isSortedAsc = (dates: string[]) =>
  dates.every((d, i) => i === 0 || Date.parse(dates[i - 1]!) <= Date.parse(d));

beforeEach(async () => {
  await resetDb();
  await seedDemoContent(prisma);
});

describe("content module", () => {
  it("getRecentUpdates returns only ministry updates, newest first", async () => {
    const updates = await getRecentUpdates("en");
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.length).toBeLessThanOrEqual(3);
    expect(updates.every((u) => u.type === "MINISTRY_UPDATE")).toBe(true);
    expect(isSortedDesc(updates.map((u) => u.publishedAt))).toBe(true);
  });

  it("respects the limit", async () => {
    expect(await getRecentUpdates("en", 1)).toHaveLength(1);
    expect(await getUpcomingEvents("en", 2)).toHaveLength(2);
    expect(await getFeaturedContent("en", 2)).toHaveLength(2);
  });

  it("getUpcomingEvents returns only upcoming events, soonest first", async () => {
    const events = await getUpcomingEvents("en");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.status === "UPCOMING")).toBe(true);
    expect(isSortedAsc(events.map((e) => e.startsAt))).toBe(true);
  });

  it("getFeaturedContent mixes featured media and devotionals, newest first", async () => {
    const items = await getFeaturedContent("en");
    expect(items.some((i) => i.kind === "media")).toBe(true);
    expect(items.some((i) => i.kind === "post")).toBe(true);
    expect(isSortedDesc(items.map((i) => i.item.publishedAt))).toBe(true);
  });

  it("resolves Nepali text for the ne locale", async () => {
    const [update] = await getRecentUpdates("ne", 1);
    const source = demoPosts.find((p) => p.id === update!.id)!;
    expect(update!.title).toBe(source.title.ne);
    expect(update!.title).toMatch(/[\u0900-\u097F]/);

    const [event] = await getUpcomingEvents("ne", 1);
    expect(event!.location).toMatch(/[\u0900-\u097F]/);
  });

  it("marks every returned item as demo content", async () => {
    const verse = await getFeaturedVerse();
    const all = [
      ...(await getRecentUpdates("en", 99)),
      ...(await getUpcomingEvents("en", 99)),
      ...(await getFeaturedContent("en", 99)).map((i) => i.item),
      verse!,
    ];
    expect(all.every((i) => i.isDemo === true)).toBe(true);
  });

  it("featured verse is WEB with a reference", async () => {
    const verse = await getFeaturedVerse();
    expect(verse!.translation).toBe("WEB");
    expect(verse!.reference).toBe("Isaiah 6:8");
    expect(await getVerseById("does-not-exist")).toBeNull();
  });

  it("demo data uses only public-domain translations and makes no tax claims", () => {
    expect(
      demoVerses.every((v) => ["WEB", "KJV"].includes(v.translation)),
    ).toBe(true);
    const blob = JSON.stringify([demoPosts, demoEvents, demoVerses, demoMedia]);
    expect(blob).not.toMatch(/tax[- ]deductible|501\(c\)/i);
    expect(demoPosts.some((p) => p.type === "TESTIMONY")).toBe(false);
  });

  it("Nepali demo text never quotes scripture (no fabricated Nepali Bible text)", () => {
    const nepali = [
      ...demoPosts.flatMap((p) => [p.title.ne, p.excerpt.ne]),
      ...demoEvents.map((e) => e.title.ne),
      ...demoMedia.map((m) => m.title.ne),
    ];
    for (const text of nepali) {
      expect(text).not.toMatch(/[“”"]/);
    }
  });
});

describe("drafts never reach public reads", () => {
  it("excludes DRAFT posts, events, media and verses from every function", async () => {
    const post = await makePost({
      status: "DRAFT",
      type: "MINISTRY_UPDATE",
      publishedAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const devotional = await makePost({
      status: "DRAFT",
      type: "DEVOTIONAL",
      isFeatured: true,
      publishedAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const event = await makeEvent({
      publishStatus: "DRAFT",
      startsAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    const media = await makeMedia({
      status: "DRAFT",
      isFeatured: true,
      publishedAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const verse = await makeVerse({
      status: "DRAFT",
      featuredOn: new Date("2026-02-01T00:00:00.000Z"),
    });
    const now = new Date("2026-03-01T12:00:00.000Z");

    const ids = [
      ...(await getRecentUpdates("en", 99)).map((p) => p.id),
      ...(await getFeaturedContent("en", 99)).map((i) => i.item.id),
      ...(await getUpcomingEvents("en", 99)).map((e) => e.id),
    ];
    for (const draft of [post, devotional, event, media])
      expect(ids).not.toContain(draft.id);
    expect(await getVerseById(verse.id)).toBeNull();
    expect((await getFeaturedVerse(now))!.id).toBe("isaiah-6-8");
  });
});

describe("Nepali fallback", () => {
  it("falls back to English when the Nepali title is null or blank", async () => {
    const future = new Date("2031-01-01T00:00:00.000Z");
    const nullNe = await makePost({
      titleEn: "Only English",
      titleNe: null,
      publishedAt: future,
    });
    const blankNe = await makePost({
      titleEn: "Blank Nepali",
      titleNe: "   ",
      excerptNe: "",
      publishedAt: new Date(future.getTime() - 1000),
    });
    const updates = await getRecentUpdates("ne", 2);
    expect(updates.map((u) => u.id)).toEqual([nullNe.id, blankNe.id]);
    expect(updates[0]!.title).toBe("Only English");
    expect(updates[1]!.title).toBe("Blank Nepali");
    expect(updates[1]!.excerpt).toBe("Test excerpt");
  });
});

describe("featured verse precedence", () => {
  const now = new Date("2026-03-15T18:30:00.000Z");

  it("prefers the verse featured today (UTC)", async () => {
    const today = await makeVerse({
      featuredOn: new Date("2026-03-15T00:00:00.000Z"),
    });
    expect((await getFeaturedVerse(now))!.id).toBe(today.id);
  });

  it("otherwise uses the latest past featured verse, ignoring future ones", async () => {
    const past = await makeVerse({
      featuredOn: new Date("2026-03-10T00:00:00.000Z"),
    });
    await makeVerse({ featuredOn: new Date("2026-03-20T00:00:00.000Z") });
    expect((await getFeaturedVerse(now))!.id).toBe(past.id);
  });

  it("otherwise uses the newest published verse", async () => {
    await prisma.bibleVerse.updateMany({ data: { featuredOn: null } });
    const newest = await makeVerse({
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    expect((await getFeaturedVerse(now))!.id).toBe(newest.id);
  });

  it("returns null when no published verse exists", async () => {
    await prisma.bibleVerse.deleteMany();
    await makeVerse({ status: "DRAFT" });
    expect(await getFeaturedVerse(now)).toBeNull();
  });
});

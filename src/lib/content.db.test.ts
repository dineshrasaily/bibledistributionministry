import { beforeEach, describe, expect, it } from "vitest";
import { demoEvents } from "@/content/demo/events";
import { demoMedia } from "@/content/demo/media";
import { demoPosts } from "@/content/demo/posts";
import { demoVerses } from "@/content/demo/verses";
import { resetDb } from "@/test/db-setup";
import {
  makeCategory,
  makeEvent,
  makeGallery,
  makeMedia,
  makePost,
  makeVerse,
} from "@/test/factories";
import { seedDemoContent } from "../../prisma/seed-lib";
import {
  getFeaturedContent,
  getFeaturedVerse,
  getMediaCenter,
  getMissions,
  getPublishedEventBySlug,
  getPublishedPostBySlug,
  getPublishedSlugs,
  getRecentUpdates,
  getUpcomingEvents,
  getVerseById,
  getVersesByReferences,
  listPublicCategories,
  listPublishedPosts,
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
      ...demoPosts.flatMap((p) => [p.title.ne, p.excerpt.ne, p.body?.ne ?? ""]),
      ...demoEvents.flatMap((e) => [
        e.description?.ne ?? "",
        e.report?.ne ?? "",
        e.volunteerInfo?.ne ?? "",
      ]),
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

describe("listPublishedPosts (Devotionals list)", () => {
  it("lists every published post type, newest first, 9 per page", async () => {
    const page = await listPublishedPosts({ page: 1 }, "en");
    expect(page.total).toBe(6);
    expect(page.pageSize).toBe(9);
    expect(page.pageCount).toBe(1);
    expect(new Set(page.items.map((p) => p.type)).size).toBeGreaterThan(1);
    expect(isSortedDesc(page.items.map((p) => p.publishedAt))).toBe(true);
  });

  it("excludes drafts", async () => {
    const draft = await makePost({ status: "DRAFT", titleEn: "Hidden draft" });
    const page = await listPublishedPosts({ page: 1, q: "Hidden draft" }, "en");
    expect(page.items.map((p) => p.id)).not.toContain(draft.id);
    expect(page.total).toBe(0);
  });

  it("searches English and Nepali titles and the body, case-insensitively", async () => {
    const en = await listPublishedPosts({ page: 1, q: "SHEPHERD" }, "en");
    expect(en.items.map((p) => p.slug)).toEqual(["sample-devotional-shepherd"]);
    const ne = await listPublishedPosts({ page: 1, q: "भजनसंग्रह" }, "ne");
    expect(ne.items.map((p) => p.slug)).toContain("sample-devotional-shepherd");
    const body = await makePost({
      bodyEn: "Only the body mentions zebracorn.",
      publishedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const byBody = await listPublishedPosts({ page: 1, q: "zebracorn" }, "en");
    expect(byBody.items.map((p) => p.id)).toEqual([body.id]);
  });

  it("filters by type and by category slug", async () => {
    const studies = await listPublishedPosts(
      { page: 1, type: "BIBLE_STUDY" },
      "en",
    );
    expect(studies.items.map((p) => p.slug)).toEqual([
      "sample-bible-study-john-3",
    ]);
    const byCategory = await listPublishedPosts(
      { page: 1, category: "scripture-study" },
      "en",
    );
    expect(byCategory.items.map((p) => p.id).sort()).toEqual([
      "post-2",
      "post-6",
    ]);
    expect(byCategory.items[0]!.categories.map((c) => c.slug)).toContain(
      "scripture-study",
    );
    const none = await listPublishedPosts(
      { page: 1, category: "does-not-exist" },
      "en",
    );
    expect(none.total).toBe(0);
  });

  it("paginates and clamps to the last page", async () => {
    for (let i = 0; i < 5; i++) {
      await makePost({
        type: "ARTICLE",
        publishedAt: new Date(Date.UTC(2020, 0, i + 1)),
      });
    }
    const first = await listPublishedPosts({ page: 1 }, "en");
    expect(first.total).toBe(11);
    expect(first.pageCount).toBe(2);
    expect(first.items).toHaveLength(9);
    const last = await listPublishedPosts({ page: 99 }, "en");
    expect(last.page).toBe(2);
    expect(last.items).toHaveLength(2);
  });
});

describe("public categories and detail reads", () => {
  it("lists only categories with a published post, localized", async () => {
    const empty = await makeCategory({ nameEn: "Empty category" });
    const draftOnly = await makeCategory({ nameEn: "Draft only" });
    await makePost({
      status: "DRAFT",
      categories: { create: [{ categoryId: draftOnly.id }] },
    });
    const en = await listPublicCategories("en");
    expect(en.map((c) => c.slug).sort()).toEqual([
      "faith-and-prayer",
      "scripture-study",
    ]);
    expect(en.map((c) => c.slug)).not.toContain(empty.slug);
    const ne = await listPublicCategories("ne");
    expect(ne.every((c) => /[\u0900-\u097F]/.test(c.name))).toBe(true);
  });

  it("getPublishedPostBySlug returns published posts only", async () => {
    const draft = await makePost({ status: "DRAFT" });
    expect(await getPublishedPostBySlug(draft.slug, "en")).toBeNull();
    expect(await getPublishedPostBySlug("does-not-exist", "en")).toBeNull();
    expect(await getPublishedPostBySlug("Bad Slug!", "en")).toBeNull();
    const post = await getPublishedPostBySlug(
      "sample-devotional-here-i-am",
      "ne",
    );
    expect(post!.title).toMatch(/[\u0900-\u097F]/);
    expect(post!.body).toMatch(/[\u0900-\u097F]/);
    expect(post!.categories.map((c) => c.slug)).toEqual(["faith-and-prayer"]);
  });

  it("getVersesByReferences matches the exact reference only, in order", async () => {
    await makeVerse({ reference: "Isaiah 6:9", status: "DRAFT" });
    const verses = await getVersesByReferences([
      "John 3:16",
      "Isaiah 6",
      "Isaiah 6:8",
      "Isaiah 6:9",
    ]);
    expect(verses.map((v) => v.reference)).toEqual(["John 3:16", "Isaiah 6:8"]);
    expect(await getVersesByReferences([])).toEqual([]);
  });
});

describe("missions", () => {
  it("splits upcoming (soonest first) and completed (newest first)", async () => {
    await makeEvent({
      status: "COMPLETED",
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
    });
    const { upcoming, completed } = await getMissions("en");
    expect(upcoming.every((e) => e.status === "UPCOMING")).toBe(true);
    expect(isSortedAsc(upcoming.map((e) => e.startsAt))).toBe(true);
    expect(completed.every((e) => e.status === "COMPLETED")).toBe(true);
    expect(isSortedDesc(completed.map((e) => e.startsAt))).toBe(true);
    expect(completed).toHaveLength(2);
  });

  it("excludes cancelled and draft events from the lists, but cancelled details resolve", async () => {
    const cancelled = await makeEvent({ status: "CANCELLED" });
    const draft = await makeEvent({ publishStatus: "DRAFT" });
    const { upcoming, completed } = await getMissions("en");
    const ids = [...upcoming, ...completed].map((e) => e.id);
    expect(ids).not.toContain(cancelled.id);
    expect(ids).not.toContain(draft.id);
    expect((await getPublishedEventBySlug(cancelled.slug, "en"))!.status).toBe(
      "CANCELLED",
    );
    expect(await getPublishedEventBySlug(draft.slug, "en")).toBeNull();
    expect(await getPublishedEventBySlug("nope", "en")).toBeNull();
  });

  // Phase 7: rewritten for the Gallery model (was MediaItem.eventId).
  it("the gallery holds only published photos of published linked galleries, in order", async () => {
    const event = await makeEvent();
    const gallery = await makeGallery({
      eventId: event.id,
      status: "PUBLISHED",
    });
    const draftGallery = await makeGallery({
      eventId: event.id,
      status: "DRAFT",
    });
    const image = (data: Parameters<typeof makeMedia>[0]) =>
      makeMedia({
        type: "IMAGE",
        category: "GALLERY",
        url: "/demo/gallery/sample-1.svg",
        altTextEn: "Alt",
        embedUrl: null,
        isFeatured: false,
        galleryId: gallery.id,
        ...data,
      });
    const second = await image({ sortOrder: 2 });
    const first = await image({ sortOrder: 1 });
    await image({ sortOrder: 0, status: "DRAFT" });
    await image({ sortOrder: 0, galleryId: null });
    await image({ sortOrder: 0, galleryId: draftGallery.id });
    await makeMedia({ galleryId: gallery.id, isFeatured: false }); // a video

    const detail = await getPublishedEventBySlug(event.slug, "en");
    expect(detail!.gallery.map((m) => m.id)).toEqual([first.id, second.id]);

    const demo = await getPublishedEventBySlug("sample-past-gathering", "en");
    expect(demo!.gallery.map((m) => m.id)).toEqual([
      "media-photo-1",
      "media-photo-2",
      "media-photo-3",
    ]);
    expect(demo!.report?.text).toMatch(/Sample trip report/);
  });

  it("deleting an event unlinks its galleries, and deleting a gallery unlinks its photos", async () => {
    const event = await makeEvent();
    const gallery = await makeGallery({ eventId: event.id });
    const photo = await makeMedia({
      type: "IMAGE",
      url: "/a.svg",
      altTextEn: "Alt",
      embedUrl: null,
      galleryId: gallery.id,
    });
    await prisma.event.delete({ where: { id: event.id } });
    expect(
      (await prisma.gallery.findUniqueOrThrow({ where: { id: gallery.id } }))
        .eventId,
    ).toBeNull();
    await prisma.gallery.delete({ where: { id: gallery.id } });
    expect(
      (await prisma.mediaItem.findUniqueOrThrow({ where: { id: photo.id } }))
        .galleryId,
    ).toBeNull();
  });
});

describe("getMediaCenter", () => {
  it("groups by category and type and builds galleries", async () => {
    const center = await getMediaCenter("en");
    expect(center.sermons.map((m) => m.id).sort()).toEqual([
      "media-1",
      "media-3",
    ]);
    expect(center.worship.map((m) => m.id)).toEqual(["media-4"]);
    expect(center.audio.map((m) => m.id)).toEqual(["media-5"]);
    expect(center.audio[0]!.audioUrl).toBe("/demo/audio/sample-silence.wav");
    expect(center.videos.map((m) => m.id)).toEqual(["media-2"]);
    expect(center.galleries.map((g) => g.id)).toEqual([
      "gallery-event-4",
      "other",
    ]);
    expect(center.galleries[0]!.event?.slug).toBe("sample-past-gathering");
    expect(center.galleries[0]!.title).toBe("Sample past gathering");
    expect(center.galleries[0]!.items.map((m) => m.id)).toEqual([
      "media-photo-1",
      "media-photo-2",
      "media-photo-3",
    ]);
    expect(center.galleries[1]!.items.map((m) => m.id)).toEqual([
      "media-photo-4",
    ]);
  });

  it("drops drafts and unsafe embeds; draft galleries and their photos stay hidden", async () => {
    const draftEvent = await makeEvent({ publishStatus: "DRAFT" });
    const draftGallery = await makeGallery({ status: "DRAFT" });
    const linkedToDraftEvent = await makeGallery({
      status: "PUBLISHED",
      eventId: draftEvent.id,
    });
    const unsafe = await makeMedia({
      isFeatured: false,
      embedUrl: "https://www.youtube.com/embed/aaaaaaaaaaa",
    });
    const draft = await makeMedia({ isFeatured: false, status: "DRAFT" });
    const photo = (galleryId: string | null) =>
      makeMedia({
        type: "IMAGE",
        url: "/a.svg",
        altTextEn: "Alt",
        embedUrl: null,
        isFeatured: false,
        galleryId,
      });
    const hidden = await photo(draftGallery.id);
    const shown = await photo(linkedToDraftEvent.id);
    const center = await getMediaCenter("en");
    const video = center.videos.find((m) => m.id === unsafe.id);
    expect(video!.embedUrl).toBeNull();
    expect(center.videos.map((m) => m.id)).not.toContain(draft.id);
    const allPhotos = center.galleries.flatMap((g) => g.items.map((m) => m.id));
    expect(allPhotos).not.toContain(hidden.id);
    const group = center.galleries.find((g) => g.id === linkedToDraftEvent.id)!;
    expect(group.items.map((m) => m.id)).toEqual([shown.id]);
    expect(group.event).toBeNull();
    expect(center.galleries.map((g) => g.id)).not.toContain(draftGallery.id);
  });
});
describe("getPublishedSlugs", () => {
  it("excludes drafts", async () => {
    const draftPost = await makePost({ status: "DRAFT" });
    const draftEvent = await makeEvent({ publishStatus: "DRAFT" });
    const { posts, events } = await getPublishedSlugs();
    expect(posts.map((p) => p.slug)).toContain("sample-devotional-here-i-am");
    expect(posts.map((p) => p.slug)).not.toContain(draftPost.slug);
    expect(events.map((e) => e.slug)).toContain("sample-past-gathering");
    expect(events.map((e) => e.slug)).not.toContain(draftEvent.slug);
  });
});

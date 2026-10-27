import { describe, expect, it } from "vitest";
import type { Event, MediaItem, Post } from "@/generated/prisma/client";
import {
  groupPhotoGalleries,
  mediaDisplayKind,
  safeEmbedUrl,
  toEventDetail,
  toMediaSummary,
  toMediaView,
  toPostDetail,
  toPostSummary,
} from "./content-mappers";
import { pick } from "./localize";

const created = new Date("2026-01-02T03:04:05.000Z");

const post = (overrides: Partial<Post> = {}): Post => ({
  id: "p1",
  type: "DEVOTIONAL",
  slug: "p1",
  titleEn: "English title",
  titleNe: "नेपाली शीर्षक",
  excerptEn: "English excerpt",
  excerptNe: null,
  bodyEn: "",
  bodyNe: null,
  scriptureRefs: ["John 3:16"],
  coverImageUrl: null,
  status: "PUBLISHED",
  publishedAt: new Date("2026-05-01T00:00:00.000Z"),
  isFeatured: false,
  isDemo: false,
  seoTitleEn: null,
  seoTitleNe: null,
  seoDescriptionEn: null,
  seoDescriptionNe: null,
  authorId: null,
  createdAt: created,
  updatedAt: created,
  ...overrides,
});

const media = (overrides: Partial<MediaItem> = {}): MediaItem => ({
  id: "m1",
  type: "VIDEO_EMBED",
  category: "GENERAL",
  titleEn: "Media",
  titleNe: null,
  descriptionEn: null,
  descriptionNe: null,
  url: null,
  embedUrl: null,
  altTextEn: null,
  altTextNe: null,
  durationMinutes: null,
  thumbnailUrl: null,
  publishedAt: created,
  isFeatured: true,
  status: "PUBLISHED",
  isDemo: false,
  eventId: null,
  sortOrder: 0,
  createdAt: created,
  updatedAt: created,
  ...overrides,
});

const event = (overrides: Partial<Event> = {}): Event => ({
  id: "e1",
  kind: "MISSION_TRIP",
  slug: "e1",
  titleEn: "Trip",
  titleNe: null,
  descriptionEn: "Description",
  descriptionNe: null,
  reportEn: null,
  reportNe: null,
  startsAt: created,
  endsAt: null,
  locationEn: "Somewhere",
  locationNe: null,
  volunteerInfoEn: "First.\n\nSecond.",
  volunteerInfoNe: null,
  status: "UPCOMING",
  publishStatus: "PUBLISHED",
  coverImageUrl: null,
  isDemo: false,
  createdAt: created,
  updatedAt: created,
  ...overrides,
});

describe("pick", () => {
  it("uses Nepali only when present and non-blank", () => {
    expect(pick("en", null, "ne")).toBe("en");
    expect(pick("en", "", "ne")).toBe("en");
    expect(pick("en", "  ", "ne")).toBe("en");
    expect(pick("en", "ने", "ne")).toBe("ने");
    expect(pick("en", "ने", "en")).toBe("en");
  });
});

describe("mediaDisplayKind", () => {
  it("maps type and category to the display kind", () => {
    expect(mediaDisplayKind("VIDEO_EMBED", "SERMON")).toBe("SERMON");
    expect(mediaDisplayKind("AUDIO", "SERMON")).toBe("SERMON");
    expect(mediaDisplayKind("VIDEO_EMBED", "GENERAL")).toBe("VIDEO");
    expect(mediaDisplayKind("AUDIO", "PODCAST")).toBe("AUDIO");
    expect(mediaDisplayKind("IMAGE", "GALLERY")).toBe("IMAGE");
  });
});

describe("content mappers", () => {
  it("toPostSummary resolves locale text and falls back to createdAt when publishedAt is null", () => {
    expect(toPostSummary(post(), "ne").title).toBe("नेपाली शीर्षक");
    expect(toPostSummary(post(), "ne").excerpt).toBe("English excerpt");
    expect(toPostSummary(post({ publishedAt: null }), "en").publishedAt).toBe(
      created.toISOString(),
    );
  });

  it("toMediaSummary turns a null description into an empty string and keeps null minutes", () => {
    const summary = toMediaSummary(media(), "en");
    expect(summary.description).toBe("");
    expect(summary.durationMinutes).toBeNull();
    expect(summary.kind).toBe("VIDEO");
  });

  it("toPostSummary drops unsafe cover URLs and maps categories by locale", () => {
    const row = {
      ...post({ coverImageUrl: "javascript:alert(1)" }),
      categories: [
        { category: { slug: "b", nameEn: "Beta", nameNe: "बिटा" } },
        { category: { slug: "a", nameEn: "Alpha", nameNe: null } },
      ],
    };
    const summary = toPostSummary(row, "en");
    expect(summary.coverImageUrl).toBeNull();
    expect(summary.categories).toEqual([
      { slug: "a", name: "Alpha" },
      { slug: "b", name: "Beta" },
    ]);
    expect(toPostSummary(row, "ne").categories.map((c) => c.name)).toContain(
      "बिटा",
    );
    expect(
      toPostSummary(post({ coverImageUrl: "/demo/a.svg" }), "en").coverImageUrl,
    ).toBe("/demo/a.svg");
  });
});

describe("toPostDetail", () => {
  it("shows the Nepali body when present", () => {
    const detail = toPostDetail(
      post({ bodyEn: "English body", bodyNe: "नेपाली" }),
      "ne",
    );
    expect(detail.body).toBe("नेपाली");
    expect(detail.bodyLang).toBeUndefined();
    expect(detail.bodyIsFallback).toBe(false);
  });

  it("falls back to the English body with lang=en on Nepali pages", () => {
    const detail = toPostDetail(
      post({ bodyEn: "English body", bodyNe: "  " }),
      "ne",
    );
    expect(detail.body).toBe("English body");
    expect(detail.bodyLang).toBe("en");
    expect(detail.bodyIsFallback).toBe(true);
    expect(toPostDetail(post({ bodyEn: "x" }), "en").bodyLang).toBeUndefined();
  });

  it("gives an empty body when neither language has one, and SEO fallbacks", () => {
    const detail = toPostDetail(
      post({ seoTitleEn: "SEO", seoDescriptionEn: " " }),
      "en",
    );
    expect(detail.body).toBe("");
    expect(detail.bodyIsFallback).toBe(false);
    expect(detail.seoTitle).toBe("SEO");
    expect(detail.seoDescription).toBeNull();
  });
});

describe("toEventDetail", () => {
  it("splits volunteer info and marks English fallback on Nepali pages", () => {
    const detail = toEventDetail(event(), "ne");
    expect(detail.volunteerInfo).toEqual({
      paragraphs: ["First.", "Second."],
      lang: "en",
    });
    expect(detail.description).toEqual({ text: "Description", lang: "en" });
    expect(detail.report).toBeNull();
    expect(
      toEventDetail(event({ coverImageUrl: "http://x" }), "en").coverImageUrl,
    ).toBeNull();
  });
});

describe("toMediaView", () => {
  it("accepts only the canonical youtube-nocookie embed URL", () => {
    const ok = "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa";
    expect(toMediaView(media({ embedUrl: ok }), "en").embedUrl).toBe(ok);
    for (const bad of [
      "https://www.youtube.com/embed/aaaaaaaaaaa",
      "https://www.youtube-nocookie.com/embed/x",
      "https://evil.example/embed/aaaaaaaaaaa",
      "javascript:alert(1)",
    ]) {
      expect(toMediaView(media({ embedUrl: bad }), "en").embedUrl).toBeNull();
    }
    expect(safeEmbedUrl(null)).toBeNull();
  });

  it("rejects http: audio and only exposes audio for AUDIO items", () => {
    expect(
      toMediaView(media({ type: "AUDIO", url: "http://x.test/a.mp3" }), "en")
        .audioUrl,
    ).toBeNull();
    expect(
      toMediaView(media({ type: "AUDIO", url: "/demo/audio/a.wav" }), "en")
        .audioUrl,
    ).toBe("/demo/audio/a.wav");
    expect(
      toMediaView(media({ type: "VIDEO_EMBED", url: "/a.wav" }), "en").audioUrl,
    ).toBeNull();
  });

  it("needs a safe URL and alt text for images", () => {
    const image = (o: Partial<MediaItem>) =>
      toMediaView(media({ type: "IMAGE", url: "/a.svg", ...o }), "ne").image;
    expect(image({ altTextEn: "Alt", altTextNe: "वैकल्पिक" })).toEqual({
      url: "/a.svg",
      alt: "वैकल्पिक",
    });
    expect(image({ altTextEn: "Alt" })).toEqual({ url: "/a.svg", alt: "Alt" });
    expect(image({ altTextEn: null })).toBeNull();
    expect(
      image({ altTextEn: "Alt", url: "data:image/png;base64,x" }),
    ).toBeNull();
  });
});

describe("groupPhotoGalleries", () => {
  const photo = (id: string, eventId: string | null, sortOrder = 0) =>
    toMediaView(
      media({
        id,
        type: "IMAGE",
        url: "/a.svg",
        altTextEn: id,
        eventId,
        sortOrder,
      }),
      "en",
    );

  it("groups by event in event order, sorts by sortOrder, and puts the rest last", () => {
    const groups = groupPhotoGalleries(
      [
        photo("p1", "e2", 2),
        photo("p2", null),
        photo("p3", "e1"),
        photo("p4", "e2", 1),
        photo("p5", "unpublished-event"),
      ],
      [
        { id: "e1", title: "One", slug: "one" },
        { id: "e2", title: "Two", slug: "two" },
        { id: "e3", title: "Empty", slug: "empty" },
      ],
    );
    expect(groups.map((g) => g.event?.slug ?? null)).toEqual([
      "one",
      "two",
      null,
    ]);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["p4", "p1"]);
    expect(groups[2]!.items.map((i) => i.id)).toEqual(["p2", "p5"]);
  });
});

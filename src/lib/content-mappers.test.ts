import { describe, expect, it } from "vitest";
import type { MediaItem, Post } from "@/generated/prisma/client";
import {
  mediaDisplayKind,
  toMediaSummary,
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
});

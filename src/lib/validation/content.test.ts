import { describe, expect, it } from "vitest";
import { categorySchema } from "./categories";
import { eventSchema } from "./events";
import { mediaSchema, updateMediaSchema } from "./media";
import { postSchema, postStatusSchema } from "./posts";
import { featureVerseSchema, verseSchema } from "./verses";

const validPost = {
  type: "MINISTRY_UPDATE",
  titleEn: "Hello",
  titleNe: "",
  slug: "hello",
  excerptEn: "Short",
  excerptNe: "  ",
  bodyEn: "# Body",
  scriptureRefs: ["John 3:16\nIsaiah 6:8, Psalm 23:1"],
  categoryIds: ["cat-1", "cat-1", ""],
  coverImageUrl: "",
  isFeatured: "on",
  publishedAt: "",
  intent: "publish",
};

describe("postSchema", () => {
  it("parses a valid post and normalizes optional fields", () => {
    const post = postSchema.parse(validPost);
    expect(post.titleNe).toBeNull();
    expect(post.excerptNe).toBeNull();
    expect(post.bodyNe).toBeNull();
    expect(post.coverImageUrl).toBeNull();
    expect(post.publishedAt).toBeNull();
    expect(post.isFeatured).toBe(true);
    expect(post.scriptureRefs).toEqual([
      "John 3:16",
      "Isaiah 6:8",
      "Psalm 23:1",
    ]);
    expect(post.categoryIds).toEqual(["cat-1"]);
  });

  it("allows an empty English body", () => {
    expect(postSchema.parse({ ...validPost, bodyEn: "" }).bodyEn).toBe("");
  });

  it("rejects empty required English fields", () => {
    const result = postSchema.safeParse({ ...validPost, titleEn: " " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["titleEn"]);
  });

  it("rejects over-length fields, bad slugs, bad enums and unsafe URLs", () => {
    expect(
      postSchema.safeParse({ ...validPost, titleEn: "x".repeat(161) }).success,
    ).toBe(false);
    expect(
      postSchema.safeParse({ ...validPost, slug: "Bad Slug!" }).success,
    ).toBe(false);
    expect(postSchema.safeParse({ ...validPost, type: "NEWS" }).success).toBe(
      false,
    );
    expect(
      postSchema.safeParse({ ...validPost, intent: "archive" }).success,
    ).toBe(false);
    expect(
      postSchema.safeParse({
        ...validPost,
        coverImageUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("limits scripture references to 10", () => {
    const refs = Array.from({ length: 11 }, (_, i) => `Ref ${i}`).join("\n");
    expect(
      postSchema.safeParse({ ...validPost, scriptureRefs: refs }).success,
    ).toBe(false);
  });

  it("status schema accepts only DRAFT / PUBLISHED", () => {
    expect(
      postStatusSchema.safeParse({ id: "post-1", status: "PUBLISHED" }).success,
    ).toBe(true);
    expect(
      postStatusSchema.safeParse({ id: "post-1", status: "LIVE" }).success,
    ).toBe(false);
  });
});

describe("categorySchema / verseSchema", () => {
  it("category requires nameEn and a slug", () => {
    expect(
      categorySchema.parse({ nameEn: "News", slug: "news" }).nameNe,
    ).toBeNull();
    expect(categorySchema.safeParse({ nameEn: "", slug: "news" }).success).toBe(
      false,
    );
  });

  it("verse validates translation and featured date", () => {
    const verse = verseSchema.parse({
      reference: "John 3:16",
      text: "For God so loved the world…",
      translation: "WEB",
      featuredOn: "2026-01-01",
      intent: "draft",
    });
    expect(verse.featuredOn?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(
      verseSchema.safeParse({
        reference: "John 3:16",
        text: "x",
        translation: "NIV",
        intent: "draft",
      }).success,
    ).toBe(false);
    expect(
      featureVerseSchema.safeParse({ id: "isaiah-6-8", date: "nope" }).success,
    ).toBe(false);
  });
});

describe("eventSchema", () => {
  const validEvent = {
    kind: "MISSION_TRIP",
    slug: "trip",
    titleEn: "Trip",
    startsAt: "2026-05-01T09:00:00+00:00",
    endsAt: "2026-05-03T09:00:00+00:00",
    status: "UPCOMING",
    intent: "draft",
  };

  it("accepts a valid event", () => {
    expect(eventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rejects endsAt before startsAt on the endsAt field", () => {
    const result = eventSchema.safeParse({
      ...validEvent,
      endsAt: "2026-04-30T09:00:00+00:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endsAt"]);
  });

  it("requires startsAt and a valid lifecycle status", () => {
    expect(eventSchema.safeParse({ ...validEvent, startsAt: "" }).success).toBe(
      false,
    );
    expect(
      eventSchema.safeParse({ ...validEvent, status: "DONE" }).success,
    ).toBe(false);
  });
});

describe("mediaSchema", () => {
  const base = {
    category: "GENERAL",
    titleEn: "Item",
    intent: "draft",
  };

  it("IMAGE requires a safe url and English alt text", () => {
    expect(
      mediaSchema.safeParse({
        ...base,
        type: "IMAGE",
        url: "https://example.org/a.jpg",
        altTextEn: "A church",
      }).success,
    ).toBe(true);
    const noAlt = mediaSchema.safeParse({
      ...base,
      type: "IMAGE",
      url: "https://example.org/a.jpg",
      altTextEn: "",
    });
    expect(noAlt.success).toBe(false);
    expect(noAlt.error?.issues[0]?.path).toEqual(["altTextEn"]);
  });

  it("VIDEO_EMBED requires a YouTube link and normalizes it", () => {
    const parsed = mediaSchema.parse({
      ...base,
      type: "VIDEO_EMBED",
      embedUrl: "https://youtu.be/dQw4w9WgXcQ",
      durationMinutes: "12",
    });
    expect(parsed.type === "VIDEO_EMBED" && parsed.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(parsed.durationMinutes).toBe(12);
    expect(
      mediaSchema.safeParse({
        ...base,
        type: "VIDEO_EMBED",
        embedUrl: "https://vimeo.com/1",
      }).success,
    ).toBe(false);
  });

  it("AUDIO requires a url; invalid type and duration are rejected", () => {
    expect(mediaSchema.safeParse({ ...base, type: "AUDIO" }).success).toBe(
      false,
    );
    expect(mediaSchema.safeParse({ ...base, type: "PDF" }).success).toBe(false);
    expect(
      mediaSchema.safeParse({
        ...base,
        type: "AUDIO",
        url: "/a.mp3",
        durationMinutes: "-1",
      }).success,
    ).toBe(false);
  });

  it("update schema requires an id", () => {
    expect(
      updateMediaSchema.safeParse({
        ...base,
        type: "AUDIO",
        url: "/a.mp3",
      }).success,
    ).toBe(false);
  });
});

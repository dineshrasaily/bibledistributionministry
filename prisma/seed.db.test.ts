import { beforeEach, describe, expect, it } from "vitest";
import { demoCategories } from "@/content/demo/categories";
import { demoEvents } from "@/content/demo/events";
import { demoMedia } from "@/content/demo/media";
import { demoPosts } from "@/content/demo/posts";
import { demoVerses } from "@/content/demo/verses";
import { prisma } from "@/lib/db";
import { resetDb } from "@/test/db-setup";
import { seedDemoContent } from "./seed-lib";

const sortedIds = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

beforeEach(async () => {
  await resetDb();
});

describe("seedDemoContent", () => {
  it("is idempotent: seeding twice gives identical counts", async () => {
    const first = await seedDemoContent(prisma);
    const second = await seedDemoContent(prisma);
    expect(first).toEqual({
      posts: 6,
      events: 4,
      verses: 3,
      media: 9,
      categories: 2,
      settings: 1,
    });
    expect(second).toEqual(first);
    expect(await prisma.postCategory.count()).toBe(5);
  });

  // Phase 7: rewritten for the Gallery model (was MediaItem.eventId).
  it("puts the demo photos in the past gathering's gallery, in order", async () => {
    await seedDemoContent(prisma);
    await seedDemoContent(prisma); // idempotent: no duplicate gallery
    expect(await prisma.gallery.count()).toBe(1);
    const gallery = await prisma.gallery.findUniqueOrThrow({
      where: { id: "gallery-event-4" },
    });
    expect(gallery).toMatchObject({
      eventId: "event-4",
      status: "PUBLISHED",
      isDemo: true,
      titleEn: "Sample past gathering",
    });
    const photos = await prisma.mediaItem.findMany({
      where: { galleryId: "gallery-event-4" },
      orderBy: { sortOrder: "asc" },
    });
    expect(photos.map((p) => p.id)).toEqual([
      "media-photo-1",
      "media-photo-2",
      "media-photo-3",
    ]);
    for (const p of photos) {
      expect(p.type).toBe("IMAGE");
      expect(p.url).toMatch(/^\/demo\/gallery\/sample-\d\.svg$/);
      expect(p.altTextEn).toMatch(/placeholder/i);
    }
    const audio = await prisma.mediaItem.findUniqueOrThrow({
      where: { id: "media-5" },
    });
    expect(audio.type).toBe("AUDIO");
    expect(audio.url).toBe("/demo/audio/sample-silence.wav");
    const worship = await prisma.mediaItem.findUniqueOrThrow({
      where: { id: "media-4" },
    });
    expect(worship.category).toBe("WORSHIP");
    // No seeded video is attributed to a real YouTube upload.
    expect(
      await prisma.mediaItem.count({ where: { embedUrl: { not: null } } }),
    ).toBe(0);
  });

  it("does not overwrite an edited body or category links on re-seed", async () => {
    await seedDemoContent(prisma);
    await prisma.post.update({
      where: { id: "post-4" },
      data: { bodyEn: "Edited body", categories: { deleteMany: {} } },
    });
    await seedDemoContent(prisma);
    const post = await prisma.post.findUniqueOrThrow({
      where: { id: "post-4" },
      include: { categories: true },
    });
    expect(post.bodyEn).toBe("Edited body");
    expect(post.categories).toHaveLength(0);
  });

  it("never overwrites admin edits on re-seed", async () => {
    await seedDemoContent(prisma);
    await prisma.post.update({
      where: { id: "post-1" },
      data: { titleEn: "Edited by admin" },
    });
    await prisma.siteSettings.update({
      where: { id: "singleton" },
      data: { ministryName: "Edited Ministry" },
    });
    await seedDemoContent(prisma);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: "post-1" } }))
        .titleEn,
    ).toBe("Edited by admin");
    expect(
      (
        await prisma.siteSettings.findUniqueOrThrow({
          where: { id: "singleton" },
        })
      ).ministryName,
    ).toBe("Edited Ministry");
  });

  it("marks every seeded row as demo content and keeps the demo ids", async () => {
    await seedDemoContent(prisma);
    const [posts, events, verses, media, settings] = await Promise.all([
      prisma.post.findMany(),
      prisma.event.findMany(),
      prisma.bibleVerse.findMany(),
      prisma.mediaItem.findMany(),
      prisma.siteSettings.findUniqueOrThrow({ where: { id: "singleton" } }),
    ]);
    for (const row of [...posts, ...events, ...verses, ...media])
      expect(row.isDemo).toBe(true);
    expect(settings.isDemo).toBe(true);
    expect(settings.socialLinks).toEqual([]);
    expect(sortedIds(posts)).toEqual(sortedIds([...demoPosts]));
    expect(sortedIds(events)).toEqual(sortedIds([...demoEvents]));
    expect(sortedIds(verses)).toEqual(sortedIds([...demoVerses]));
    expect(sortedIds(media)).toEqual(sortedIds([...demoMedia]));
    expect(sortedIds(await prisma.category.findMany())).toEqual(
      sortedIds([...demoCategories]),
    );
  });

  it("stores Devanagari text intact (UTF-8 database)", async () => {
    await seedDemoContent(prisma);
    const post = await prisma.post.findUniqueOrThrow({
      where: { id: "post-1" },
    });
    expect(post.titleNe).toBe(demoPosts[0]!.title.ne);
  });
});

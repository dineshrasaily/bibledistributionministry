import { beforeEach, describe, expect, it } from "vitest";
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
      media: 3,
      settings: 1,
    });
    expect(second).toEqual(first);
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
  });

  it("stores Devanagari text intact (UTF-8 database)", async () => {
    await seedDemoContent(prisma);
    const post = await prisma.post.findUniqueOrThrow({
      where: { id: "post-1" },
    });
    expect(post.titleNe).toBe(demoPosts[0]!.title.ne);
  });
});

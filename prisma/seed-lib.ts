/**
 * Idempotent, non-destructive demo seed. Every write is a create-only upsert
 * keyed on the demo id, so re-running never overwrites admin edits.
 * `npm run db:reset` is the way back to pristine demo data.
 *
 * Pure module (used by prisma/seed.ts, DB tests and scripts/e2e-prepare.ts).
 */
import { defaultSiteSettings } from "@/config/site";
import { demoCategories } from "@/content/demo/categories";
import { demoEvents } from "@/content/demo/events";
import { demoMedia } from "@/content/demo/media";
import { demoPosts } from "@/content/demo/posts";
import type { MediaKind } from "@/content/demo/types";
import { demoVerses } from "@/content/demo/verses";
import type { PrismaClient } from "@/generated/prisma/client";
import type { MediaCategory, MediaType } from "@/generated/prisma/enums";

export type SeedReport = {
  posts: number;
  events: number;
  verses: number;
  media: number;
  categories: number;
  settings: number;
};

/** Fixed past date: the demo featured verse stays "the most recent featured verse" forever. */
export const DEMO_FEATURED_VERSE_DATE = new Date("2026-01-01T00:00:00.000Z");
const FEATURED_DEMO_VERSE_ID = "isaiah-6-8";

const MEDIA_KIND_MAP: Record<
  MediaKind,
  { type: MediaType; category: MediaCategory }
> = {
  SERMON: { type: "VIDEO_EMBED", category: "SERMON" },
  VIDEO: { type: "VIDEO_EMBED", category: "GENERAL" },
  AUDIO: { type: "AUDIO", category: "PODCAST" },
  IMAGE: { type: "IMAGE", category: "GALLERY" },
};

export async function seedDemoContent(
  prisma: PrismaClient,
): Promise<SeedReport> {
  for (const category of demoCategories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {},
      create: {
        id: category.id,
        slug: category.slug,
        nameEn: category.name.en,
        nameNe: category.name.ne,
      },
    });
  }

  for (const post of demoPosts) {
    await prisma.post.upsert({
      where: { id: post.id },
      update: {},
      create: {
        id: post.id,
        type: post.type,
        slug: post.slug,
        titleEn: post.title.en,
        titleNe: post.title.ne,
        excerptEn: post.excerpt.en,
        excerptNe: post.excerpt.ne,
        bodyEn: post.body?.en ?? "",
        bodyNe: post.body?.ne ?? null,
        scriptureRefs: [...post.scriptureRefs],
        status: "PUBLISHED",
        publishedAt: new Date(post.publishedAt),
        isFeatured: post.featured ?? false,
        isDemo: true,
        authorId: null,
        ...(post.categoryIds?.length
          ? {
              categories: {
                createMany: {
                  data: post.categoryIds.map((categoryId) => ({ categoryId })),
                },
              },
            }
          : {}),
      },
    });
  }

  for (const event of demoEvents) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id,
        kind: event.kind,
        slug: event.slug,
        titleEn: event.title.en,
        titleNe: event.title.ne,
        descriptionEn: event.description?.en ?? null,
        descriptionNe: event.description?.ne ?? null,
        reportEn: event.report?.en ?? null,
        reportNe: event.report?.ne ?? null,
        volunteerInfoEn: event.volunteerInfo?.en ?? null,
        volunteerInfoNe: event.volunteerInfo?.ne ?? null,
        startsAt: new Date(event.startsAt),
        endsAt: event.endsAt ? new Date(event.endsAt) : null,
        locationEn: event.location.en,
        locationNe: event.location.ne,
        status: event.status,
        publishStatus: "PUBLISHED",
        isDemo: true,
      },
    });
  }

  for (const verse of demoVerses) {
    await prisma.bibleVerse.upsert({
      where: { id: verse.id },
      update: {},
      create: {
        id: verse.id,
        reference: verse.reference,
        text: verse.text,
        translation: verse.translation,
        featuredOn:
          verse.id === FEATURED_DEMO_VERSE_ID ? DEMO_FEATURED_VERSE_DATE : null,
        status: "PUBLISHED",
        isDemo: true,
      },
    });
  }

  for (const media of demoMedia) {
    const mapped = MEDIA_KIND_MAP[media.kind];
    await prisma.mediaItem.upsert({
      where: { id: media.id },
      update: {},
      create: {
        id: media.id,
        type: mapped.type,
        category: media.category ?? mapped.category,
        titleEn: media.title.en,
        titleNe: media.title.ne,
        descriptionEn: media.description.en,
        descriptionNe: media.description.ne,
        url: media.url ?? null,
        // Never attribute a real YouTube video to the ministry.
        embedUrl: null,
        altTextEn: media.altText?.en ?? null,
        altTextNe: media.altText?.ne ?? null,
        thumbnailUrl: media.thumbnailUrl,
        durationMinutes: media.durationMinutes,
        publishedAt: new Date(media.publishedAt),
        isFeatured: media.featured ?? false,
        eventId: media.eventId ?? null,
        sortOrder: media.sortOrder ?? 0,
        status: "PUBLISHED",
        isDemo: true,
      },
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...defaultSiteSettings },
  });

  const [posts, events, verses, media, categories, settings] =
    await Promise.all([
      prisma.post.count(),
      prisma.event.count(),
      prisma.bibleVerse.count(),
      prisma.mediaItem.count(),
      prisma.category.count(),
      prisma.siteSettings.count(),
    ]);
  return { posts, events, verses, media, categories, settings };
}

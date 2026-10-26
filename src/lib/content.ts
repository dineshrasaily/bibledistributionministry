/**
 * Data-access layer for public site content.
 *
 * Pages only talk to these functions and receive locale-resolved view
 * models. Every query returns PUBLISHED rows only; drafts never reach
 * public pages. Mapping lives in `content-mappers.ts`.
 */
import type { AppLocale } from "@/i18n/routing";
import {
  toEventSummary,
  toMediaSummary,
  toPostSummary,
  toVerseView,
  type EventSummary,
  type FeaturedItem,
  type PostSummary,
  type VerseView,
} from "./content-mappers";
import { prisma } from "./db";

export type {
  EventSummary,
  FeaturedItem,
  MediaDisplayKind,
  MediaSummary,
  PostSummary,
  VerseView,
} from "./content-mappers";

/** Latest ministry updates, newest first. */
export async function getRecentUpdates(
  locale: AppLocale,
  limit = 3,
): Promise<PostSummary[]> {
  const rows = await prisma.post.findMany({
    where: { status: "PUBLISHED", type: "MINISTRY_UPDATE" },
    orderBy: [
      { publishedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: limit,
  });
  return rows.map((row) => toPostSummary(row, locale));
}

/** Featured media and devotionals, newest first. */
export async function getFeaturedContent(
  locale: AppLocale,
  limit = 3,
): Promise<FeaturedItem[]> {
  const [posts, media] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED", type: "DEVOTIONAL", isFeatured: true },
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit,
    }),
    prisma.mediaItem.findMany({
      where: { status: "PUBLISHED", isFeatured: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ]);
  const items: FeaturedItem[] = [
    ...posts.map((row) => ({
      kind: "post" as const,
      item: toPostSummary(row, locale),
    })),
    ...media.map((row) => ({
      kind: "media" as const,
      item: toMediaSummary(row, locale),
    })),
  ];
  return items
    .toSorted(
      (a, b) => Date.parse(b.item.publishedAt) - Date.parse(a.item.publishedAt),
    )
    .slice(0, limit);
}

/** Upcoming events, soonest first. Lifecycle status is stored, so builds are deterministic. */
export async function getUpcomingEvents(
  locale: AppLocale,
  limit = 3,
): Promise<EventSummary[]> {
  const rows = await prisma.event.findMany({
    where: { publishStatus: "PUBLISHED", status: "UPCOMING" },
    orderBy: [{ startsAt: "asc" }],
    take: limit,
  });
  return rows.map((row) => toEventSummary(row, locale));
}

/** Look up a published verse by id. Verse text is always English (WEB/KJV). */
export async function getVerseById(id: string): Promise<VerseView | null> {
  const row = await prisma.bibleVerse.findFirst({
    where: { id, status: "PUBLISHED" },
  });
  return row ? toVerseView(row) : null;
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * The verse featured on the home page: today's verse (UTC), else the most
 * recent past featured verse, else the newest published verse, else null.
 */
export async function getFeaturedVerse(
  now: Date = new Date(),
): Promise<VerseView | null> {
  const today = startOfUtcDay(now);
  const featured = await prisma.bibleVerse.findFirst({
    where: { status: "PUBLISHED", featuredOn: { lte: today } },
    orderBy: { featuredOn: "desc" },
  });
  if (featured) return toVerseView(featured);
  const newest = await prisma.bibleVerse.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return newest ? toVerseView(newest) : null;
}

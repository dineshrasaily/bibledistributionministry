/**
 * Data-access layer for public site content.
 *
 * Pages only talk to these functions and receive locale-resolved view
 * models. Every query returns PUBLISHED rows only; drafts never reach
 * public pages. Mapping lives in `content-mappers.ts`.
 */
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";
import {
  toCategoryView,
  toEventDetail,
  toEventSummary,
  toMediaSummary,
  toMediaView,
  toPhotoGroups,
  toPostDetail,
  toPostSummary,
  toVerseView,
  type CategoryView,
  type EventDetail,
  type EventSummary,
  type FeaturedItem,
  type MediaView,
  type PhotoGroup,
  type PostDetail,
  type PostSummary,
  type VerseView,
} from "./content-mappers";
import { prisma } from "./db";
import { ilike, paginate, type Page } from "./pagination";
import {
  toPublicShareView,
  type PublicShareView,
} from "./public-share-mappers";
import { SLUG_RE } from "./validation/common";
import {
  PUBLIC_POST_PAGE_SIZE,
  type PublicPostQuery,
} from "./validation/public-query";

export type {
  CategoryView,
  EventDetail,
  EventSummary,
  FeaturedItem,
  MediaDisplayKind,
  MediaSummary,
  MediaView,
  PhotoGroup,
  PostDetail,
  PostSummary,
  VerseView,
} from "./content-mappers";
export type { Page } from "./pagination";
export type { PublicShareView } from "./public-share-mappers";

const categoriesInclude = {
  categories: {
    select: {
      category: { select: { slug: true, nameEn: true, nameNe: true } },
    },
  },
} as const;

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
      // Audio has no public Media Center section, so it is never featured.
      where: { status: "PUBLISHED", isFeatured: true, type: { not: "AUDIO" } },
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

// ---------- Devotionals ----------

/** Published posts of every type, filtered and paginated (newest first). */
export async function listPublishedPosts(
  query: PublicPostQuery,
  locale: AppLocale,
): Promise<Page<PostSummary>> {
  const where: Prisma.PostWhereInput = {
    status: "PUBLISHED",
    ...(query.type ? { type: query.type } : {}),
    ...(query.category
      ? { categories: { some: { category: { slug: query.category } } } }
      : {}),
    ...(query.q
      ? {
          OR: [
            { titleEn: ilike(query.q) },
            { titleNe: ilike(query.q) },
            { excerptEn: ilike(query.q) },
            { excerptNe: ilike(query.q) },
            { bodyEn: ilike(query.q) },
            { bodyNe: ilike(query.q) },
          ],
        }
      : {}),
  };
  const page = await paginate(
    query.page,
    PUBLIC_POST_PAGE_SIZE,
    () => prisma.post.count({ where }),
    ({ skip, take }) =>
      prisma.post.findMany({
        where,
        include: categoriesInclude,
        orderBy: [
          { publishedAt: { sort: "desc", nulls: "last" } },
          { id: "asc" },
        ],
        skip,
        take,
      }),
  );
  return { ...page, items: page.items.map((r) => toPostSummary(r, locale)) };
}

/** Categories with at least one published post, by localized name. */
export async function listPublicCategories(
  locale: AppLocale,
): Promise<CategoryView[]> {
  const rows = await prisma.category.findMany({
    where: { posts: { some: { post: { status: "PUBLISHED" } } } },
    select: { slug: true, nameEn: true, nameNe: true },
  });
  return rows
    .map((row) => toCategoryView(row, locale))
    .toSorted((a, b) => a.name.localeCompare(b.name, locale));
}

/** One published post (drafts and unknown slugs give null). */
export const getPublishedPostBySlug = cache(
  async (slug: string, locale: AppLocale): Promise<PostDetail | null> => {
    if (!SLUG_RE.test(slug)) return null;
    const row = await prisma.post.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: categoriesInclude,
    });
    return row ? toPostDetail(row, locale) : null;
  },
);

/** Published verses whose reference matches exactly, in `refs` order. */
export async function getVersesByReferences(
  refs: readonly string[],
): Promise<VerseView[]> {
  if (refs.length === 0) return [];
  const rows = await prisma.bibleVerse.findMany({
    where: { status: "PUBLISHED", reference: { in: [...refs] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return refs.flatMap((ref) => {
    const row = rows.find((r) => r.reference === ref);
    return row ? [toVerseView(row)] : [];
  });
}

// ---------- Missions ----------

const MISSIONS_LIMIT = 24;

/** Upcoming (soonest first) and completed (newest first) published events. */
export async function getMissions(
  locale: AppLocale,
): Promise<{ upcoming: EventSummary[]; completed: EventSummary[] }> {
  const [upcoming, completed] = await Promise.all([
    prisma.event.findMany({
      where: { publishStatus: "PUBLISHED", status: "UPCOMING" },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: MISSIONS_LIMIT,
    }),
    prisma.event.findMany({
      where: { publishStatus: "PUBLISHED", status: "COMPLETED" },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      take: MISSIONS_LIMIT,
    }),
  ]);
  return {
    upcoming: upcoming.map((r) => toEventSummary(r, locale)),
    completed: completed.map((r) => toEventSummary(r, locale)),
  };
}

const publishedPhoto = {
  status: "PUBLISHED",
  type: "IMAGE",
} satisfies Prisma.MediaItemWhereInput;
const galleryOrder = [
  { sortOrder: "asc" },
  { publishedAt: "asc" },
  { id: "asc" },
] satisfies Prisma.MediaItemOrderByWithRelationInput[];

/** One published event (any lifecycle status) with its photo gallery. */
export const getPublishedEventBySlug = cache(
  async (
    slug: string,
    locale: AppLocale,
  ): Promise<(EventDetail & { gallery: MediaView[] }) | null> => {
    if (!SLUG_RE.test(slug)) return null;
    const row = await prisma.event.findFirst({
      where: { slug, publishStatus: "PUBLISHED" },
      include: {
        // Only PUBLISHED photos of PUBLISHED galleries (drafts never leak).
        galleries: {
          where: { status: "PUBLISHED" },
          orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
          include: { items: { where: publishedPhoto, orderBy: galleryOrder } },
        },
      },
    });
    if (!row) return null;
    const { galleries, ...event } = row;
    return {
      ...toEventDetail(event, locale),
      gallery: galleries.flatMap((g) =>
        g.items
          .map((m) => toMediaView(m, locale))
          .filter((m) => m.image !== null),
      ),
    };
  },
);

// ---------- Media Center ----------

const MEDIA_SECTION_LIMIT = 12;

/**
 * Media Center sections. The owner removed the Worship and Podcasts/audio
 * sections: worship (and any other non-sermon) videos appear under Videos,
 * and audio files are not listed publicly.
 */
export type MediaCenter = {
  sermons: MediaView[];
  videos: MediaView[];
  galleries: PhotoGroup[];
};

type MediaSection = Exclude<keyof MediaCenter, "galleries">;

function mediaSection(item: MediaView): MediaSection {
  return item.category === "SERMON" ? "sermons" : "videos";
}

/** Published media grouped for the Media Center (newest first per section). */
export async function getMediaCenter(locale: AppLocale): Promise<MediaCenter> {
  const [rows, galleries, otherPhotos] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { status: "PUBLISHED", type: { notIn: ["IMAGE", "AUDIO"] } },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 200,
    }),
    prisma.gallery.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { id: "asc" },
      ],
      take: MEDIA_SECTION_LIMIT,
      include: {
        event: true,
        items: {
          where: publishedPhoto,
          orderBy: galleryOrder,
          take: MEDIA_SECTION_LIMIT * 2,
        },
      },
    }),
    // "Other photos": published pictures outside any gallery (photos of a
    // draft gallery are never shown here).
    prisma.mediaItem.findMany({
      where: { ...publishedPhoto, galleryId: null },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: MEDIA_SECTION_LIMIT * 2,
    }),
  ]);

  const center: MediaCenter = {
    sermons: [],
    videos: [],
    galleries: [],
  };
  for (const row of rows) {
    const view = toMediaView(row, locale);
    const list = center[mediaSection(view)];
    if (list.length < MEDIA_SECTION_LIMIT) list.push(view);
  }

  center.galleries = toPhotoGroups(galleries, otherPhotos, locale);
  return center;
}

// ---------- Prayer wall ----------

/**
 * Admin-published public versions of consented prayers and testimonies.
 * Reads ONLY the PublicShare table with an explicit select: never the
 * private PrayerRequest / ContactMessage rows (no include, no relations).
 */
export async function listPublicShares(
  locale: AppLocale,
  limit = 12,
): Promise<PublicShareView[]> {
  const rows = await prisma.publicShare.findMany({
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      kind: true,
      textEn: true,
      textNe: true,
      publishedAt: true,
    },
  });
  return rows
    .map((row) => toPublicShareView(row, locale))
    .filter((v): v is PublicShareView => v !== null);
}

// ---------- Sitemap / static params ----------

/** Slugs of published posts and events (drafts excluded). */
export async function getPublishedSlugs(): Promise<{
  posts: { slug: string; updatedAt: Date }[];
  events: { slug: string; updatedAt: Date }[];
}> {
  const [posts, events] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: "asc" },
    }),
    prisma.event.findMany({
      where: { publishStatus: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: "asc" },
    }),
  ]);
  return { posts, events };
}

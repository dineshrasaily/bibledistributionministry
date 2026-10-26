/**
 * Pure mappers from Prisma rows to the locale-resolved view models used by
 * public pages. No DB access here, so they are unit-testable.
 */
import type {
  BibleVerse,
  Event,
  MediaItem,
  Post,
} from "@/generated/prisma/client";
import type {
  BibleTranslation,
  EventKind,
  EventStatus,
  MediaCategory,
  MediaType,
  PostType,
} from "@/generated/prisma/enums";
import type { AppLocale } from "@/i18n/routing";
import { pick } from "./localize";

export type PostSummary = {
  id: string;
  type: PostType;
  title: string;
  slug: string;
  excerpt: string;
  scriptureRefs: string[];
  publishedAt: string;
  isDemo: boolean;
};

export type EventSummary = {
  id: string;
  kind: EventKind;
  title: string;
  slug: string;
  startsAt: string;
  location: string;
  status: EventStatus;
  isDemo: boolean;
};

export type VerseView = {
  id: string;
  reference: string;
  translation: BibleTranslation;
  text: string;
  isDemo: boolean;
};

/** Display kind shown on media cards (label key in `MediaKinds`). */
export type MediaDisplayKind = "SERMON" | "VIDEO" | "AUDIO" | "IMAGE";

export type MediaSummary = {
  id: string;
  kind: MediaDisplayKind;
  title: string;
  description: string;
  durationMinutes: number | null;
  publishedAt: string;
  thumbnailUrl: string | null;
  isDemo: boolean;
};

export type FeaturedItem =
  { kind: "post"; item: PostSummary } | { kind: "media"; item: MediaSummary };

export function mediaDisplayKind(
  type: MediaType,
  category: MediaCategory,
): MediaDisplayKind {
  if (category === "SERMON") return "SERMON";
  if (type === "VIDEO_EMBED") return "VIDEO";
  if (type === "AUDIO") return "AUDIO";
  return "IMAGE";
}

export function toPostSummary(row: Post, locale: AppLocale): PostSummary {
  return {
    id: row.id,
    type: row.type,
    title: pick(row.titleEn, row.titleNe, locale),
    slug: row.slug,
    excerpt: pick(row.excerptEn, row.excerptNe, locale),
    scriptureRefs: [...row.scriptureRefs],
    // A PUBLISHED post always has publishedAt; never hand null to new Date().
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    isDemo: row.isDemo,
  };
}

export function toEventSummary(row: Event, locale: AppLocale): EventSummary {
  return {
    id: row.id,
    kind: row.kind,
    title: pick(row.titleEn, row.titleNe, locale),
    slug: row.slug,
    startsAt: row.startsAt.toISOString(),
    location: pick(row.locationEn, row.locationNe, locale) ?? "",
    status: row.status,
    isDemo: row.isDemo,
  };
}

export function toMediaSummary(
  row: MediaItem,
  locale: AppLocale,
): MediaSummary {
  return {
    id: row.id,
    kind: mediaDisplayKind(row.type, row.category),
    title: pick(row.titleEn, row.titleNe, locale),
    description: pick(row.descriptionEn, row.descriptionNe, locale) ?? "",
    durationMinutes: row.durationMinutes,
    publishedAt: row.publishedAt.toISOString(),
    thumbnailUrl: row.thumbnailUrl,
    isDemo: row.isDemo,
  };
}

export function toVerseView(row: BibleVerse): VerseView {
  return {
    id: row.id,
    reference: row.reference,
    translation: row.translation,
    text: row.text,
    isDemo: row.isDemo,
  };
}

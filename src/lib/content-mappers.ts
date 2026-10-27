/**
 * Pure mappers from Prisma rows to the locale-resolved view models used by
 * public pages. No DB access here, so they are unit-testable.
 */
import type {
  BibleVerse,
  Category,
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
import { splitParagraphs } from "./site-settings-mappers";
import { isSafeUrl, toYouTubeEmbed } from "./validation/common";

/** A stored URL that is safe to render (https or site path), else null. */
export function safeUrlOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed !== "" && isSafeUrl(trimmed) ? trimmed : null;
}

/** Localized text plus `lang="en"` when a Nepali page falls back to English. */
export type LocalizedBlock = { text: string; lang: "en" | undefined };

export function localizedBlock(
  en: string | null | undefined,
  ne: string | null | undefined,
  locale: AppLocale,
): LocalizedBlock | null {
  const hasNe = ne != null && ne.trim() !== "";
  const hasEn = en != null && en.trim() !== "";
  if (locale === "ne" && hasNe) return { text: ne, lang: undefined };
  if (hasEn) return { text: en, lang: locale === "ne" ? "en" : undefined };
  return null;
}

export type CategoryView = { slug: string; name: string };

export type PostSummary = {
  id: string;
  type: PostType;
  title: string;
  slug: string;
  excerpt: string;
  scriptureRefs: string[];
  publishedAt: string;
  coverImageUrl: string | null;
  categories: CategoryView[];
  isDemo: boolean;
};

export type PostDetail = PostSummary & {
  /** Markdown; "" when neither language has a body (show the excerpt). */
  body: string;
  /** "en" when a Nepali page shows the English body. */
  bodyLang: "en" | undefined;
  bodyIsFallback: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};

export type EventSummary = {
  id: string;
  kind: EventKind;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  status: EventStatus;
  coverImageUrl: string | null;
  isDemo: boolean;
};

export type EventDetail = EventSummary & {
  description: LocalizedBlock | null;
  report: LocalizedBlock | null;
  volunteerInfo: { paragraphs: string[]; lang: "en" | undefined } | null;
  updatedAt: string;
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

export type PostRow = Post & {
  categories?: { category: Pick<Category, "slug" | "nameEn" | "nameNe"> }[];
};

export function toCategoryView(
  row: Pick<Category, "slug" | "nameEn" | "nameNe">,
  locale: AppLocale,
): CategoryView {
  return { slug: row.slug, name: pick(row.nameEn, row.nameNe, locale) };
}

export function toPostSummary(row: PostRow, locale: AppLocale): PostSummary {
  return {
    id: row.id,
    type: row.type,
    title: pick(row.titleEn, row.titleNe, locale),
    slug: row.slug,
    excerpt: pick(row.excerptEn, row.excerptNe, locale),
    scriptureRefs: [...row.scriptureRefs],
    // A PUBLISHED post always has publishedAt; never hand null to new Date().
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    coverImageUrl: safeUrlOrNull(row.coverImageUrl),
    categories: (row.categories ?? [])
      .map((pc) => toCategoryView(pc.category, locale))
      .toSorted((a, b) => a.name.localeCompare(b.name)),
    isDemo: row.isDemo,
  };
}

export function toPostDetail(row: PostRow, locale: AppLocale): PostDetail {
  const body = localizedBlock(row.bodyEn, row.bodyNe, locale);
  const blankToNull = (v: string | null) =>
    v != null && v.trim() !== "" ? v : null;
  return {
    ...toPostSummary(row, locale),
    body: body?.text ?? "",
    bodyLang: body?.lang,
    bodyIsFallback: body?.lang === "en",
    seoTitle: blankToNull(pick(row.seoTitleEn, row.seoTitleNe, locale)),
    seoDescription: blankToNull(
      pick(row.seoDescriptionEn, row.seoDescriptionNe, locale),
    ),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toEventSummary(row: Event, locale: AppLocale): EventSummary {
  return {
    id: row.id,
    kind: row.kind,
    title: pick(row.titleEn, row.titleNe, locale),
    slug: row.slug,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    location: pick(row.locationEn, row.locationNe, locale) ?? "",
    status: row.status,
    coverImageUrl: safeUrlOrNull(row.coverImageUrl),
    isDemo: row.isDemo,
  };
}

export function toEventDetail(row: Event, locale: AppLocale): EventDetail {
  const volunteer = localizedBlock(
    row.volunteerInfoEn,
    row.volunteerInfoNe,
    locale,
  );
  return {
    ...toEventSummary(row, locale),
    description: localizedBlock(row.descriptionEn, row.descriptionNe, locale),
    report: localizedBlock(row.reportEn, row.reportNe, locale),
    volunteerInfo: volunteer
      ? { paragraphs: splitParagraphs(volunteer.text), lang: volunteer.lang }
      : null,
    updatedAt: row.updatedAt.toISOString(),
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
    thumbnailUrl: safeUrlOrNull(row.thumbnailUrl),
    isDemo: row.isDemo,
  };
}

/** A media item ready for the Media Center / galleries. */
export type MediaView = MediaSummary & {
  type: MediaType;
  category: MediaCategory;
  eventId: string | null;
  sortOrder: number;
  /** AUDIO only: a safe URL, else null ("audio coming soon"). */
  audioUrl: string | null;
  /** VIDEO_EMBED only: re-validated youtube-nocookie embed URL, else null. */
  embedUrl: string | null;
  /** IMAGE only: safe URL plus alt text, else null. */
  image: { url: string; alt: string } | null;
};

/** Only https://www.youtube-nocookie.com/embed/<11-char id> passes. */
export function safeEmbedUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = toYouTubeEmbed(value.trim());
  return normalized !== null && normalized === value.trim() ? normalized : null;
}

export function toMediaView(row: MediaItem, locale: AppLocale): MediaView {
  const imageUrl = row.type === "IMAGE" ? safeUrlOrNull(row.url) : null;
  const alt = pick(row.altTextEn, row.altTextNe, locale)?.trim() ?? "";
  return {
    ...toMediaSummary(row, locale),
    type: row.type,
    category: row.category,
    eventId: row.eventId,
    sortOrder: row.sortOrder,
    audioUrl: row.type === "AUDIO" ? safeUrlOrNull(row.url) : null,
    embedUrl: row.type === "VIDEO_EMBED" ? safeEmbedUrl(row.embedUrl) : null,
    image: imageUrl && alt !== "" ? { url: imageUrl, alt } : null,
  };
}

export type PhotoGroup = {
  event: { id: string; title: string; slug: string } | null;
  items: MediaView[];
};

/**
 * Groups photos by linked (published) event, in the order of `events`;
 * photos without a published event go to a final "Other photos" group.
 * Items inside an event group are ordered by sortOrder (stable).
 */
export function groupPhotoGalleries(
  images: readonly MediaView[],
  events: readonly { id: string; title: string; slug: string }[],
): PhotoGroup[] {
  const known = new Set(events.map((e) => e.id));
  const groups: PhotoGroup[] = events
    .map((event) => ({
      event,
      items: images
        .filter((m) => m.eventId === event.id)
        .toSorted((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((g) => g.items.length > 0);
  const other = images.filter(
    (m) => m.eventId == null || !known.has(m.eventId),
  );
  if (other.length > 0) groups.push({ event: null, items: other });
  return groups;
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

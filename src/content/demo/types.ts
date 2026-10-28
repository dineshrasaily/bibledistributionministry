/**
 * Demo content shapes. They mirror the Prisma models planned for Phase 4
 * (Post, Event, Verse, MediaItem) so the data layer can be swapped without
 * touching pages. Every record carries `isDemo: true`.
 */

export type LocalizedText = { en: string; ne: string };

export type PostType =
  "DEVOTIONAL" | "ARTICLE" | "MINISTRY_UPDATE" | "BIBLE_STUDY" | "TESTIMONY";

export type DemoPost = {
  id: string;
  type: PostType;
  title: LocalizedText;
  slug: string;
  excerpt: LocalizedText;
  scriptureRefs: string[];
  /** ISO 8601 date-time. */
  publishedAt: string;
  featured?: boolean;
  /** Sample Markdown body. Bible quotes only in English (WEB) with the reference. */
  body?: LocalizedText;
  categoryIds?: string[];
  isDemo: true;
};

export type DemoCategory = {
  id: string;
  slug: string;
  name: LocalizedText;
};

export type EventKind =
  "MISSION_TRIP" | "OUTREACH" | "SERVICE" | "ANNOUNCEMENT";
export type EventStatus = "UPCOMING" | "COMPLETED";

export type DemoEvent = {
  id: string;
  kind: EventKind;
  title: LocalizedText;
  slug: string;
  /** ISO 8601 date-time. */
  startsAt: string;
  /** ISO 8601 date-time. */
  endsAt?: string;
  location: LocalizedText;
  status: EventStatus;
  /** Markdown. */
  description?: LocalizedText;
  /** Markdown post-trip report. */
  report?: LocalizedText;
  /** Plain text, paragraphs separated by blank lines. */
  volunteerInfo?: LocalizedText;
  isDemo: true;
};

export type DemoVerse = {
  id: string;
  reference: string;
  /** Public-domain translations only. */
  translation: "WEB" | "KJV";
  /** English text from the stated translation (never a Nepali translation). */
  text: string;
  isDemo: true;
};

export type MediaKind = "SERMON" | "VIDEO" | "AUDIO" | "IMAGE";

export type DemoMedia = {
  id: string;
  kind: MediaKind;
  /** Overrides the category implied by `kind` (e.g. WORSHIP). */
  category?: "SERMON" | "WORSHIP" | "PODCAST" | "GALLERY" | "GENERAL";
  title: LocalizedText;
  description: LocalizedText;
  durationMinutes: number | null;
  /** ISO 8601 date-time. */
  publishedAt: string;
  featured?: boolean;
  /** No uploads yet; null renders a placeholder thumbnail. */
  thumbnailUrl: string | null;
  /** IMAGE / AUDIO: a site path under /demo/. */
  url?: string;
  /** IMAGE only. */
  altText?: LocalizedText;
  /** Puts a photo in a demo gallery (ordered by sortOrder). */
  galleryId?: string;
  sortOrder?: number;
  isDemo: true;
};

export type DemoGallery = {
  id: string;
  /** Linked demo event (its title is reused). */
  eventId: string;
  title: LocalizedText;
  isDemo: true;
};

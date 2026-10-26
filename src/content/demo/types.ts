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
  isDemo: true;
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
  location: LocalizedText;
  status: EventStatus;
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

export type MediaKind = "SERMON" | "VIDEO" | "AUDIO";

export type DemoMedia = {
  id: string;
  kind: MediaKind;
  title: LocalizedText;
  description: LocalizedText;
  durationMinutes: number;
  /** ISO 8601 date-time. */
  publishedAt: string;
  featured?: boolean;
  /** No uploads yet; the UI renders a placeholder thumbnail. */
  thumbnailUrl: null;
  isDemo: true;
};

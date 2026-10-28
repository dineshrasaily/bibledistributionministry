/** English admin labels for enum values (pure module, safe for client use). */

export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
export type IdParams = Promise<{ id: string }>;

export const POST_TYPE_LABELS = {
  DEVOTIONAL: "Devotional",
  ARTICLE: "Article",
  MINISTRY_UPDATE: "Ministry update",
  BIBLE_STUDY: "Bible study",
  TESTIMONY: "Testimony",
} as const;

export const CONTENT_STATUS_LABELS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
} as const;

export const EVENT_KIND_LABELS = {
  MISSION_TRIP: "Mission trip",
  OUTREACH: "Outreach",
  SERVICE: "Service",
  ANNOUNCEMENT: "Announcement",
} as const;

export const EVENT_STATUS_LABELS = {
  UPCOMING: "Upcoming",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const MEDIA_TYPE_LABELS = {
  IMAGE: "Image",
  AUDIO: "Audio",
  VIDEO_EMBED: "YouTube video",
} as const;

export const MEDIA_CATEGORY_LABELS = {
  SERMON: "Sermon",
  WORSHIP: "Worship",
  PODCAST: "Podcast",
  GALLERY: "Gallery",
  GENERAL: "General",
} as const;

export const TRANSLATION_LABELS = {
  WEB: "World English Bible (WEB)",
  KJV: "King James Version (KJV)",
} as const;

export const PRAYER_STATUS_LABELS = {
  NEW: "New",
  PRAYED: "Prayed",
  ARCHIVED: "Archived",
} as const;

export const MESSAGE_STATUS_LABELS = {
  NEW: "New",
  READ: "Read",
  ARCHIVED: "Archived",
} as const;

export const MESSAGE_KIND_LABELS = {
  GENERAL: "General",
  TESTIMONY: "Testimony",
  VOLUNTEER: "Volunteer",
} as const;

export const DONATION_STATUS_LABELS = {
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  REFUNDED: "Refunded",
} as const;

export const DONATION_INTERVAL_LABELS = {
  ONE_TIME: "One-time",
  MONTHLY: "Monthly",
} as const;

export const DONATION_MODE_LABELS = {
  live: "Live",
  test: "Test",
} as const;

/** { KEY: "Label" } -> select options in declaration order. */
export function optionsOf(
  labels: Readonly<Record<string, string>>,
): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export const formatDate = (d: Date | null | undefined) =>
  d ? dateFmt.format(d) : "—";
export const formatDateTime = (d: Date | null | undefined) =>
  d ? dateTimeFmt.format(d) : "—";

/** YYYY-MM-DD of a UTC date (verse featuredOn). */
export const isoDay = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10) : "";

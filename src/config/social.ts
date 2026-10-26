/**
 * Supported social platforms. Key order is display order; labels always come
 * from here, never from the database. Pure module.
 */
export const SOCIAL_PLATFORMS = {
  facebook: "Facebook",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  website: "Website",
} as const;

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

/** Rendered as "(placeholder)" rows in the footer when no social URL is stored. */
export const PLACEHOLDER_PLATFORMS: readonly SocialPlatform[] = [
  "facebook",
  "youtube",
  "instagram",
];

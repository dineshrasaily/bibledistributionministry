/**
 * Pure mapping from the SiteSettings row to locale-resolved values used by
 * the public layout (header, footer, hero, metadata). Unit tested.
 */
import { z } from "zod";
import {
  PLACEHOLDER_PLATFORMS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/config/social";
import type { SiteSettings } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { pick } from "./localize";

export type LocalizedSocialLink = {
  platform: SocialPlatform;
  label: string;
  /** null renders the "(placeholder)" row. */
  url: string | null;
};

export type LocalizedSiteSettings = {
  name: string;
  tagline: string | null;
  missionStatement: string | null;
  aboutIntroParagraphs: string[];
  contactEmail: string;
  socialLinks: LocalizedSocialLink[];
  logoUrl: string | null;
  isDemo: boolean;
};

const platformKeys = Object.keys(SOCIAL_PLATFORMS) as [
  SocialPlatform,
  ...SocialPlatform[],
];

/** One stored social link: a known platform and an https URL. */
export const storedSocialLinkSchema = z.object({
  platform: z.enum(platformKeys),
  url: z.url({ protocol: /^https$/ }),
});

export type StoredSocialLink = z.infer<typeof storedSocialLinkSchema>;

/**
 * Parses the stored JSON leniently: invalid entries are dropped (and
 * reported through `onInvalid`), valid ones are returned in display order.
 */
export function parseStoredSocialLinks(
  value: unknown,
  onInvalid: (count: number) => void = () => {},
): StoredSocialLink[] {
  const entries = Array.isArray(value) ? value : [];
  const valid: StoredSocialLink[] = [];
  let invalid = Array.isArray(value) ? 0 : value == null ? 0 : 1;
  for (const entry of entries) {
    const parsed = storedSocialLinkSchema.safeParse(entry);
    if (parsed.success) valid.push(parsed.data);
    else invalid += 1;
  }
  if (invalid > 0) onInvalid(invalid);
  return valid.toSorted(
    (a, b) =>
      platformKeys.indexOf(a.platform) - platformKeys.indexOf(b.platform),
  );
}

function blankToNull(value: string | null): string | null {
  return value != null && value.trim() !== "" ? value : null;
}

export function splitParagraphs(value: string | null): string[] {
  if (value == null) return [];
  return value
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

export function toLocalizedSiteSettings(
  row: SiteSettings,
  locale: AppLocale,
  onInvalidSocial?: (count: number) => void,
): LocalizedSiteSettings {
  const stored = parseStoredSocialLinks(row.socialLinks, onInvalidSocial);
  const socialLinks: LocalizedSocialLink[] =
    stored.length > 0
      ? stored.map(({ platform, url }) => ({
          platform,
          label: SOCIAL_PLATFORMS[platform],
          url,
        }))
      : PLACEHOLDER_PLATFORMS.map((platform) => ({
          platform,
          label: SOCIAL_PLATFORMS[platform],
          url: null,
        }));

  return {
    name: row.ministryName,
    tagline: blankToNull(pick(row.taglineEn, row.taglineNe, locale)),
    missionStatement: blankToNull(
      pick(row.missionStatementEn, row.missionStatementNe, locale),
    ),
    aboutIntroParagraphs: splitParagraphs(
      pick(row.aboutIntroEn, row.aboutIntroNe, locale),
    ),
    contactEmail: row.contactEmail,
    socialLinks,
    logoUrl: blankToNull(row.logoUrl),
    isDemo: row.isDemo,
  };
}

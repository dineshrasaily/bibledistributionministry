import { z } from "zod";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/config/social";
import {
  checkbox,
  emailSchema,
  optionalMarkdown,
  optionalSafeUrl,
  optionalText,
  requiredText,
} from "./common";

export const SOCIAL_URL_MSG = "Enter a full link starting with https://";
export const ABOUT_IMAGE_ALT_MSG =
  "Describe the photo for people who can't see it.";

const platformKeys = Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[];

/** Form field name for a platform's URL input. */
export const socialFieldName = (platform: SocialPlatform) =>
  `social.${platform}` as const;

const socialUrl = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v == null || v === "" ? null : v))
  .pipe(
    z
      .url({ protocol: /^https$/, error: SOCIAL_URL_MSG })
      .max(300, SOCIAL_URL_MSG)
      .nullable(),
  );

const socialShape = Object.fromEntries(
  platformKeys.map((p) => [socialFieldName(p), socialUrl]),
) as Record<`social.${SocialPlatform}`, typeof socialUrl>;

export const settingsSchema = z
  .object({
    ministryName: requiredText(80),
    taglineEn: optionalText(120),
    taglineNe: optionalText(120),
    missionStatementEn: optionalText(600),
    missionStatementNe: optionalText(600),
    visionEn: optionalMarkdown(10_000),
    visionNe: optionalMarkdown(10_000),
    valuesEn: optionalMarkdown(10_000),
    valuesNe: optionalMarkdown(10_000),
    statementOfFaithEn: optionalMarkdown(10_000),
    statementOfFaithNe: optionalMarkdown(10_000),
    aboutIntroEn: optionalText(3000),
    aboutIntroNe: optionalText(3000),
    testimonyEn: optionalMarkdown(10_000),
    testimonyNe: optionalMarkdown(10_000),
    goalsEn: optionalMarkdown(10_000),
    goalsNe: optionalMarkdown(10_000),
    aboutImageUrl: optionalSafeUrl(),
    aboutImageAltEn: optionalText(300),
    aboutImageAltNe: optionalText(300),
    logoUrl: optionalSafeUrl(),
    contactEmail: emailSchema,
    donationsEnabled: checkbox(),
    taxDeductibleVerified: checkbox(),
    givingInfoEn: optionalMarkdown(5000),
    givingInfoNe: optionalMarkdown(5000),
    isDemo: checkbox(),
    ...socialShape,
  })
  .superRefine((input, ctx) => {
    if (input.aboutImageUrl && !input.aboutImageAltEn) {
      ctx.addIssue({
        code: "custom",
        message: ABOUT_IMAGE_ALT_MSG,
        path: ["aboutImageAltEn"],
      });
    }
  })
  .transform((input) => {
    const socialLinks: { platform: SocialPlatform; url: string }[] = [];
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!key.startsWith("social.")) rest[key] = value;
    }
    // SOCIAL_PLATFORMS order; only non-empty URLs are stored.
    for (const platform of platformKeys) {
      const url = input[socialFieldName(platform)];
      if (url) socialLinks.push({ platform, url });
    }
    type Base = Omit<typeof input, `social.${SocialPlatform}`>;
    return { ...(rest as Base), socialLinks };
  });

export type SettingsInput = z.output<typeof settingsSchema>;

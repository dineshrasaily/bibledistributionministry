import { z } from "zod";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/config/social";
import { DEFAULT_SITE_TIME_ZONE, isValidTimeZone } from "@/config/time-zones";
import {
  checkbox,
  emailSchema,
  isValidAbaRouting,
  optionalEmail,
  optionalMarkdown,
  optionalSafeUrl,
  optionalText,
  requiredText,
} from "./common";

export const SOCIAL_URL_MSG = "Enter a full link starting with https://";
export const ABOUT_IMAGE_ALT_MSG =
  "Describe the photo for people who can't see it.";

// Zelle + bank transfer (Support page).
export const ZELLE_NAME_REQUIRED_MSG =
  "Add the recipient name exactly as your bank app shows it.";
export const PHONE_MSG = "Enter a phone number, for example (555) 123-4567.";
export const ROUTING_MSG =
  "Enter a valid 9-digit US routing number (ABA). Check it for typos.";
export const ACCOUNT_NUMBER_MSG =
  "Enter the account number using 4 to 17 digits.";
export const SWIFT_MSG =
  "Enter an 8 or 11 character SWIFT/BIC code, for example BOFAUS3N.";
export const BANK_DETAILS_MISSING_MSG =
  "Add the account or routing number, or turn this off.";
export const zelleQrDefaultAlt = (name: string) => `Zelle QR code for ${name}`;

// Verse of the day.
export const TIMEZONE_MSG = "Choose a time zone from the list.";
export const TRANSLATION_MSG = "Choose WEB or KJV.";

const PHONE_RE = /^[0-9 ()+\-.]{7,20}$/;
const SWIFT_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** Loose phone check: allowed characters only and at least 7 digits. */
export const isValidPhone = (v: string) =>
  PHONE_RE.test(v) && (v.match(/\d/g) ?? []).length >= 7;

/** Optional value that is normalized (spaces etc. stripped) before checking. */
function normalizedOptional(
  strip: (s: string) => string,
  check: (s: string) => boolean,
  message: string,
) {
  return optionalText(40)
    .transform((v) => (v == null ? null : strip(v)))
    .refine((v) => v == null || check(v), message);
}

const stripSpacesAndHyphens = (s: string) => s.replace(/[\s-]/g, "");

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
    offlineGivingEnabled: checkbox(),
    zelleRecipientName: optionalText(100),
    zelleEmail: optionalEmail(),
    zellePhone: optionalText(20).refine(
      (v) => v == null || isValidPhone(v),
      PHONE_MSG,
    ),
    zelleQrUrl: optionalSafeUrl(),
    zelleQrAltEn: optionalText(300),
    zelleQrAltNe: optionalText(300),
    bankName: optionalText(100),
    bankAccountName: optionalText(100),
    bankAccountNumber: normalizedOptional(
      stripSpacesAndHyphens,
      (v) => /^\d{4,17}$/.test(v),
      ACCOUNT_NUMBER_MSG,
    ),
    bankRoutingNumber: normalizedOptional(
      stripSpacesAndHyphens,
      isValidAbaRouting,
      ROUTING_MSG,
    ),
    bankSwiftCode: normalizedOptional(
      (s) => s.replace(/\s/g, "").toUpperCase(),
      (v) => SWIFT_RE.test(v),
      SWIFT_MSG,
    ),
    bankAddress: optionalText(300),
    bankShowAccountDetails: checkbox(),
    offlineGivingNoteEn: optionalText(500),
    offlineGivingNoteNe: optionalText(500),
    autoVerseEnabled: checkbox(),
    // Absent (a partial post) keeps the defaults; anything else must match.
    autoVerseTranslation: z
      .enum(["WEB", "KJV"], { error: TRANSLATION_MSG })
      .optional()
      .default("WEB"),
    siteTimezone: z
      .string({ error: TIMEZONE_MSG })
      .trim()
      .optional()
      .default(DEFAULT_SITE_TIME_ZONE)
      .refine(isValidTimeZone, TIMEZONE_MSG),
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
    if (
      (input.zelleEmail || input.zellePhone || input.zelleQrUrl) &&
      !input.zelleRecipientName
    ) {
      ctx.addIssue({
        code: "custom",
        message: ZELLE_NAME_REQUIRED_MSG,
        path: ["zelleRecipientName"],
      });
    }
    if (
      input.bankShowAccountDetails &&
      !input.bankAccountNumber &&
      !input.bankRoutingNumber &&
      !input.bankSwiftCode
    ) {
      ctx.addIssue({
        code: "custom",
        message: BANK_DETAILS_MISSING_MSG,
        path: ["bankAccountNumber"],
      });
    }
  })
  .transform((input) => {
    // A QR picture always has a description: default it from the recipient.
    if (input.zelleQrUrl && !input.zelleQrAltEn && input.zelleRecipientName) {
      input = {
        ...input,
        zelleQrAltEn: zelleQrDefaultAlt(input.zelleRecipientName),
      };
    }
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

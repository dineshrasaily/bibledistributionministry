/**
 * Static site configuration and the default ministry settings.
 *
 * Ministry identity (name, tagline, contact email, social links, ...) lives in
 * the `SiteSettings` database row and is read through
 * `getSiteSettings()` / `getLocalizedSiteSettings()` in `src/lib/site-settings.ts`.
 * `defaultSiteSettings` seeds that row and is the fallback when it is missing.
 *
 * Pure module (no server-only / next imports): the seed script imports it.
 */
import type { SiteSettings } from "@/generated/prisma/client";

export const siteConfig = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;

export function getSiteConfig(): SiteConfig {
  return siteConfig;
}

export const defaultSiteSettings = {
  ministryName: "Demo Ministry",
  taglineEn: "Faith · Hope · Service",
  taglineNe: "विश्वास · आशा · सेवा",
  missionStatementEn:
    "A sample mission statement: sharing the hope of the Gospel through Scripture, prayer and practical care for communities near and far.",
  missionStatementNe:
    "नमूना मिशन वाक्य: धर्मशास्त्र, प्रार्थना र व्यावहारिक हेरचाहमार्फत नजिक र टाढाका समुदायहरूसँग सुसमाचारको आशा बाँड्ने।",
  visionEn: null,
  visionNe: null,
  valuesEn: null,
  valuesNe: null,
  statementOfFaithEn: null,
  statementOfFaithNe: null,
  aboutIntroEn:
    "This is sample introduction text. In a later phase it will describe the story, vision and values of the ministry in the founder's own words.\n\nFor now it shows how an introduction will look: a short, warm welcome that invites visitors to read, pray and take part.",
  aboutIntroNe:
    "यो नमूना परिचय पाठ हो। पछिल्लो चरणमा यसले संस्थापकको आफ्नै शब्दमा सेवकाइको कथा, दर्शन र मूल्यहरू वर्णन गर्नेछ।\n\nअहिलेलाई यसले परिचय कस्तो देखिन्छ भनेर देखाउँछ: पाठकहरूलाई पढ्न, प्रार्थना गर्न र सहभागी हुन निम्तो दिने छोटो, न्यानो स्वागत।",
  testimonyEn: null,
  testimonyNe: null,
  goalsEn: null,
  goalsNe: null,
  aboutImageUrl: null,
  aboutImageAltEn: null,
  aboutImageAltNe: null,
  logoUrl: null,
  contactEmail: "hello@example.org",
  socialLinks: [],
  donationsEnabled: false,
  taxDeductibleVerified: false,
  isDemo: true,
} satisfies Omit<SiteSettings, "id" | "updatedAt">;

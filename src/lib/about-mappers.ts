/**
 * Pure mapping from SiteSettings to the About page sections.
 *
 * Each section is either real content, a demo fallback (only while
 * `isDemo` is on; the page shows clearly-marked sample text from messages),
 * or null (hidden). Markdown stays raw; the page renders it through
 * MarkdownContent. Unit tested.
 */
import type { SiteSettings } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/routing";
import { splitParagraphs } from "./site-settings-mappers";
import { isSafeUrl } from "./validation/common";

export const ABOUT_SECTION_KEYS = [
  "story",
  "testimony",
  "mission",
  "vision",
  "values",
  "statementOfFaith",
  "goals",
] as const;
export type AboutSectionKey = (typeof ABOUT_SECTION_KEYS)[number];

export type AboutSection<T> =
  | {
      status: "content";
      value: T;
      /** "en" when a Nepali page shows the English text. */
      textLang: "en" | undefined;
    }
  | { status: "fallback" };

export type AboutContent = {
  story: AboutSection<string[]> | null;
  testimony: AboutSection<string> | null;
  mission: AboutSection<string> | null;
  vision: AboutSection<string> | null;
  values: AboutSection<string> | null;
  statementOfFaith: AboutSection<string> | null;
  goals: AboutSection<string> | null;
  image: { url: string; alt: string } | null;
  isDemo: boolean;
};

const blank = (v: string | null | undefined): v is null | undefined =>
  v == null || v.trim() === "";

function section(
  en: string | null,
  ne: string | null,
  locale: AppLocale,
  isDemo: boolean,
): AboutSection<string> | null {
  if (locale === "ne" && !blank(ne)) {
    return { status: "content", value: ne, textLang: undefined };
  }
  if (!blank(en)) {
    return {
      status: "content",
      value: en,
      textLang: locale === "ne" ? "en" : undefined,
    };
  }
  return isDemo ? { status: "fallback" } : null;
}

export function toAboutContent(
  row: SiteSettings,
  locale: AppLocale,
): AboutContent {
  const demo = row.isDemo;
  const story = section(row.aboutIntroEn, row.aboutIntroNe, locale, demo);

  const url = row.aboutImageUrl?.trim() ?? "";
  const altEn = row.aboutImageAltEn?.trim() ?? "";
  const altNe = row.aboutImageAltNe?.trim() ?? "";
  const image =
    url !== "" && altEn !== "" && isSafeUrl(url)
      ? { url, alt: locale === "ne" && altNe !== "" ? altNe : altEn }
      : null;

  return {
    story:
      story?.status === "content"
        ? { ...story, value: splitParagraphs(story.value) }
        : story,
    testimony: section(row.testimonyEn, row.testimonyNe, locale, demo),
    mission: section(
      row.missionStatementEn,
      row.missionStatementNe,
      locale,
      demo,
    ),
    vision: section(row.visionEn, row.visionNe, locale, demo),
    values: section(row.valuesEn, row.valuesNe, locale, demo),
    statementOfFaith: section(
      row.statementOfFaithEn,
      row.statementOfFaithNe,
      locale,
      demo,
    ),
    goals: section(row.goalsEn, row.goalsNe, locale, demo),
    image,
    isDemo: demo,
  };
}

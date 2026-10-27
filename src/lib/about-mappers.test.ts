import { describe, expect, it } from "vitest";
import { defaultSiteSettings } from "@/config/site";
import type { SiteSettings } from "@/generated/prisma/client";
import { ABOUT_SECTION_KEYS, toAboutContent } from "./about-mappers";

const row = (overrides: Partial<SiteSettings> = {}): SiteSettings => ({
  ...defaultSiteSettings,
  id: "singleton",
  updatedAt: new Date(0),
  aboutIntroEn: null,
  aboutIntroNe: null,
  missionStatementEn: null,
  missionStatementNe: null,
  ...overrides,
});

describe("toAboutContent", () => {
  it("shows demo fallbacks for empty sections only while isDemo is on", () => {
    const demo = toAboutContent(row({ isDemo: true }), "en");
    for (const key of ABOUT_SECTION_KEYS) {
      expect(demo[key], key).toEqual({ status: "fallback" });
    }
    const live = toAboutContent(row({ isDemo: false }), "en");
    for (const key of ABOUT_SECTION_KEYS) {
      expect(live[key], key).toBeNull();
    }
  });

  it("uses real content when present, with Nepali first and English fallback", () => {
    const content = toAboutContent(
      row({
        isDemo: false,
        testimonyEn: "My **story**",
        testimonyNe: "मेरो कथा",
        visionEn: "Vision text",
        aboutIntroEn: "Para one.\n\nPara two.",
        missionStatementEn: "Mission",
      }),
      "ne",
    );
    expect(content.testimony).toEqual({
      status: "content",
      value: "मेरो कथा",
      textLang: undefined,
    });
    expect(content.vision).toEqual({
      status: "content",
      value: "Vision text",
      textLang: "en",
    });
    expect(content.story).toEqual({
      status: "content",
      value: ["Para one.", "Para two."],
      textLang: "en",
    });
    expect(content.mission?.status).toBe("content");
    expect(content.goals).toBeNull();
  });

  it("treats whitespace-only text as empty", () => {
    expect(
      toAboutContent(row({ isDemo: false, goalsEn: "  " }), "en").goals,
    ).toBeNull();
  });

  it("keeps the photo only with a safe URL and English alt text", () => {
    const image = (o: Partial<SiteSettings>, locale: "en" | "ne" = "en") =>
      toAboutContent(row(o), locale).image;
    expect(
      image({ aboutImageUrl: "/brand/logo-full.png", aboutImageAltEn: "Logo" }),
    ).toEqual({ url: "/brand/logo-full.png", alt: "Logo" });
    expect(
      image(
        {
          aboutImageUrl: "https://example.org/a.jpg",
          aboutImageAltEn: "Alt",
          aboutImageAltNe: "विवरण",
        },
        "ne",
      ),
    ).toEqual({ url: "https://example.org/a.jpg", alt: "विवरण" });
    expect(
      image({ aboutImageUrl: "/a.jpg", aboutImageAltEn: null }),
    ).toBeNull();
    expect(
      image({ aboutImageUrl: "javascript:alert(1)", aboutImageAltEn: "Alt" }),
    ).toBeNull();
    expect(
      image({
        aboutImageUrl: "http://example.org/a.jpg",
        aboutImageAltEn: "Alt",
      }),
    ).toBeNull();
  });
});

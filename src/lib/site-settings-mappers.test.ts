import { describe, expect, it, vi } from "vitest";
import { defaultSiteSettings } from "@/config/site";
import type { SiteSettings } from "@/generated/prisma/client";
import { toLocalizedSiteSettings } from "./site-settings-mappers";

const row = (overrides: Partial<SiteSettings> = {}): SiteSettings => ({
  ...defaultSiteSettings,
  id: "singleton",
  updatedAt: new Date(0),
  ...overrides,
});

describe("toLocalizedSiteSettings", () => {
  it("renders the three placeholder platforms when no social link is stored", () => {
    const { socialLinks } = toLocalizedSiteSettings(row(), "en");
    expect(socialLinks).toEqual([
      { platform: "facebook", label: "Facebook", url: null },
      { platform: "youtube", label: "YouTube", url: null },
      { platform: "instagram", label: "Instagram", url: null },
    ]);
  });

  it("returns exactly the stored link, labelled from the constant", () => {
    const { socialLinks } = toLocalizedSiteSettings(
      row({
        socialLinks: [
          { platform: "youtube", url: "https://youtube.com/@demo" },
        ],
      }),
      "en",
    );
    expect(socialLinks).toEqual([
      {
        platform: "youtube",
        label: "YouTube",
        url: "https://youtube.com/@demo",
      },
    ]);
  });

  it("drops unknown platforms and non-https URLs", () => {
    const onInvalid = vi.fn();
    const { socialLinks } = toLocalizedSiteSettings(
      row({
        socialLinks: [
          { platform: "myspace", url: "https://myspace.com/x" },
          { platform: "facebook", url: "http://facebook.com/x" },
          { platform: "website", url: "https://example.org", label: "Ignored" },
          { platform: "x", url: "javascript:alert(1)" },
        ],
      }),
      "en",
      onInvalid,
    );
    expect(socialLinks).toEqual([
      { platform: "website", label: "Website", url: "https://example.org" },
    ]);
    expect(onInvalid).toHaveBeenCalledWith(3);
  });

  it("returns null tagline and mission statement when empty", () => {
    const settings = toLocalizedSiteSettings(
      row({
        taglineEn: "  ",
        taglineNe: null,
        missionStatementEn: null,
        missionStatementNe: "",
      }),
      "ne",
    );
    expect(settings.tagline).toBeNull();
    expect(settings.missionStatement).toBeNull();
  });

  it("splits the about intro on blank lines and drops empty paragraphs", () => {
    const settings = toLocalizedSiteSettings(
      row({
        aboutIntroEn: "First.\n\n  \n\nSecond.\n \nThird.",
        aboutIntroNe: null,
      }),
      "ne",
    );
    expect(settings.aboutIntroParagraphs).toEqual([
      "First.",
      "Second.",
      "Third.",
    ]);
    expect(
      toLocalizedSiteSettings(row({ aboutIntroEn: null }), "en")
        .aboutIntroParagraphs,
    ).toEqual([]);
  });

  it("maps name, email, logo and demo flag", () => {
    const settings = toLocalizedSiteSettings(row({ logoUrl: "" }), "en");
    expect(settings.name).toBe("Demo Ministry");
    expect(settings.contactEmail).toBe("hello@example.org");
    expect(settings.logoUrl).toBeNull();
    expect(settings.isDemo).toBe(true);
  });
});

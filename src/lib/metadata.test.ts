import { describe, expect, it, vi } from "vitest";

// buildPageMetadata itself is pure; its module also exports DB-backed helpers.
vi.mock("./site-settings", () => ({ getSiteSettings: vi.fn() }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));

const { buildPageMetadata } = await import("./metadata");
const { DEFAULT_OG_IMAGE } = await import("./og-image");

const base = {
  title: "About",
  description: "About the ministry",
  siteName: "Bible Distribution Ministry",
} as const;

describe("buildPageMetadata", () => {
  it("uses the default Open Graph image when the page has none", () => {
    const meta = buildPageMetadata({ ...base, locale: "en", path: "/about" });
    const expected = [
      {
        url: "/brand/og-default.png",
        width: 1200,
        height: 630,
        alt: "Bible Distribution Ministry",
      },
    ];
    expect(meta.openGraph?.images).toEqual(expected);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: expected,
    });
    expect(DEFAULT_OG_IMAGE.url).toBe("/brand/og-default.png");
  });

  it("treats an empty image list like no images", () => {
    const meta = buildPageMetadata({
      ...base,
      locale: "ne",
      path: "/",
      images: [],
    });
    expect(meta.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/brand/og-default.png" }),
    ]);
  });

  it("uses only the page's cover image when given", () => {
    const meta = buildPageMetadata({
      ...base,
      locale: "en",
      path: "/devotionals/x",
      type: "article",
      images: ["/uploads/cover.jpg"],
    });
    expect(meta.openGraph?.images).toEqual(["/uploads/cover.jpg"]);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/uploads/cover.jpg"],
    });
  });

  it.each([
    ["en", "/", "/en"],
    ["ne", "/", "/ne"],
    ["en", "/about", "/en/about"],
    ["ne", "/about", "/ne/about"],
  ] as const)(
    "keeps canonical + hreflang for %s %s",
    (locale, path, canonical) => {
      const meta = buildPageMetadata({ ...base, locale, path });
      expect(meta.alternates?.canonical).toBe(canonical);
      const suffix = path === "/" ? "" : path;
      expect(meta.alternates?.languages).toEqual({
        en: `/en${suffix}`,
        ne: `/ne${suffix}`,
        "x-default": `/en${suffix}`,
      });
    },
  );
});

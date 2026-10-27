import { describe, expect, it } from "vitest";
import { buildSitemap } from "./sitemap-entries";

describe("buildSitemap", () => {
  const updated = new Date("2026-05-01T00:00:00.000Z");
  const entries = buildSitemap(
    "https://example.org/",
    ["", "/about"],
    [
      { path: "/devotionals/a-post", lastModified: updated },
      { path: "/admin/secret", lastModified: updated },
    ],
  );
  const urls = entries.map((e) => e.url);

  it("emits every path in both locales", () => {
    expect(urls).toEqual([
      "https://example.org/en",
      "https://example.org/ne",
      "https://example.org/en/about",
      "https://example.org/ne/about",
      "https://example.org/en/devotionals/a-post",
      "https://example.org/ne/devotionals/a-post",
    ]);
  });

  it("adds hreflang alternates and keeps dynamic lastModified", () => {
    const post = entries.find((e) => e.url.endsWith("/ne/devotionals/a-post"))!;
    expect(post.alternates?.languages).toEqual({
      en: "https://example.org/en/devotionals/a-post",
      ne: "https://example.org/ne/devotionals/a-post",
    });
    expect(post.lastModified).toEqual(updated);
  });

  it("never lists the admin area", () => {
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content", () => ({
  getPublishedSlugs: vi.fn(async () => ({
    posts: [{ slug: "a-post", updatedAt: new Date("2026-05-01T00:00:00Z") }],
    events: [{ slug: "an-event", updatedAt: new Date("2026-05-02T00:00:00Z") }],
  })),
}));

const { default: sitemap } = await import("./sitemap");

describe("sitemap.xml", () => {
  it("lists localized static pages and published detail pages, never the admin area", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.some((u) => u.endsWith("/en/about"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/ne/devotionals/a-post"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/en/missions/an-event"))).toBe(true);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
  });
});

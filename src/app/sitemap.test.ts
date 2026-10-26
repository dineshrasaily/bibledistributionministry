import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("sitemap.xml", () => {
  it("lists localized public pages and never the admin area", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
  });
});

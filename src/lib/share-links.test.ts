import { describe, expect, it } from "vitest";
import { buildShareLinks } from "./share-links";

describe("buildShareLinks", () => {
  const url = "https://example.org/ne/devotionals/a-b?x=1&y=2";
  const title = "भजन & प्रार्थना";
  const links = buildShareLinks(url, title);

  it("uses the plain share endpoints (no SDKs)", () => {
    expect(new URL(links.facebook).origin).toBe("https://www.facebook.com");
    expect(new URL(links.facebook).pathname).toBe("/sharer/sharer.php");
    expect(new URL(links.x).origin).toBe("https://x.com");
    expect(new URL(links.x).pathname).toBe("/intent/post");
    expect(new URL(links.whatsapp).origin).toBe("https://wa.me");
    expect(links.email.startsWith("mailto:?")).toBe(true);
  });

  it("encodes the URL and title (ampersands, spaces, Devanagari)", () => {
    expect(new URL(links.facebook).searchParams.get("u")).toBe(url);
    const x = new URL(links.x).searchParams;
    expect(x.get("url")).toBe(url);
    expect(x.get("text")).toBe(title);
    expect(new URL(links.whatsapp).searchParams.get("text")).toBe(
      `${title} ${url}`,
    );
    expect(links.email).toBe(
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    );
    for (const link of Object.values(links)) {
      expect(link).not.toContain(" ");
      expect(link).not.toContain("भ");
    }
  });
});

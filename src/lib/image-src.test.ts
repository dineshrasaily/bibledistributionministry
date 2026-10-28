// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isBlobUrl, isOptimizableSrc } from "./image-src";
import { resolveStorageMode } from "./storage-mode";
import { isSameOrigin } from "./same-origin";

describe("isBlobUrl / isOptimizableSrc", () => {
  const blob =
    "https://abc123.public.blob.vercel-storage.com/media/images/a-x1.jpg";

  it("accepts public Vercel Blob media URLs only", () => {
    expect(isBlobUrl(blob)).toBe(true);
    expect(isOptimizableSrc(blob)).toBe(true);
    expect(isBlobUrl("http://abc.public.blob.vercel-storage.com/x.jpg")).toBe(
      false,
    );
    expect(
      isBlobUrl("https://abc.public.blob.vercel-storage.com.evil.com/x.jpg"),
    ).toBe(false);
    expect(
      isBlobUrl("https://user:pw@abc.public.blob.vercel-storage.com/x.jpg"),
    ).toBe(false);
    expect(isBlobUrl("not a url")).toBe(false);
    expect(isOptimizableSrc(`${blob}?w=1`)).toBe(false);
    expect(
      isOptimizableSrc(
        "https://abc.public.blob.vercel-storage.com/other/x.jpg",
      ),
    ).toBe(false);
  });

  it("optimizes raster brand/demo files but not SVGs, local uploads or other hosts", () => {
    expect(isOptimizableSrc("/brand/logo-mark.png")).toBe(true);
    expect(isOptimizableSrc("/demo/gallery/x.webp")).toBe(true);
    expect(isOptimizableSrc("/demo/gallery/sample-1.svg")).toBe(false);
    expect(
      isOptimizableSrc("/api/uploads/media/images/2026/10/a-abcdefghij.png"),
    ).toBe(false);
    expect(isOptimizableSrc("/brand/../secret.png")).toBe(false);
    expect(isOptimizableSrc("https://example.org/a.png")).toBe(false);
  });
});

describe("resolveStorageMode", () => {
  it("picks blob with a token, disabled on Vercel without one, else local", () => {
    expect(
      resolveStorageMode({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" }),
    ).toBe("blob");
    expect(
      resolveStorageMode({ BLOB_READ_WRITE_TOKEN: "x", VERCEL: "1" }),
    ).toBe("blob");
    expect(
      resolveStorageMode({ BLOB_READ_WRITE_TOKEN: "  ", VERCEL: "1" }),
    ).toBe("disabled");
    expect(resolveStorageMode({})).toBe("local");
    expect(resolveStorageMode({ VERCEL: "" })).toBe("local");
  });
});

describe("isSameOrigin", () => {
  const origin = "http://localhost:3000";
  const h = (init: Record<string, string>) => new Headers(init);

  it("accepts a matching Origin (with or without Sec-Fetch-Site same-origin)", () => {
    expect(isSameOrigin(h({ origin }), origin)).toBe(true);
    expect(
      isSameOrigin(h({ origin, "sec-fetch-site": "same-origin" }), origin),
    ).toBe(true);
  });

  it("rejects missing, null, mismatched and cross-site requests", () => {
    expect(isSameOrigin(h({}), origin)).toBe(false);
    expect(isSameOrigin(h({ origin: "null" }), origin)).toBe(false);
    expect(isSameOrigin(h({ origin: "https://evil.example" }), origin)).toBe(
      false,
    );
    expect(
      isSameOrigin(h({ origin, "sec-fetch-site": "cross-site" }), origin),
    ).toBe(false);
    expect(
      isSameOrigin(h({ origin, "sec-fetch-site": "same-site" }), origin),
    ).toBe(false);
  });
});

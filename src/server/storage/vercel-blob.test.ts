// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blob = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  return { head: vi.fn(), del: vi.fn(), BlobNotFoundError };
});
vi.mock("@vercel/blob", () => blob);

import { blobKeyOf, createBlobStorage } from "./vercel-blob";

const URL_OK =
  "https://store1.public.blob.vercel-storage.com/media/images/photo-Ab12.jpg";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

beforeEach(() => {
  // No real network in this suite.
  vi.stubGlobal("fetch", () => {
    throw new Error("real network call");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("vercel-blob driver", () => {
  it("parses only strict blob media URLs", () => {
    expect(blobKeyOf(URL_OK)).toBe("media/images/photo-Ab12.jpg");
    expect(blobKeyOf("https://example.org/media/images/photo.jpg")).toBeNull();
    expect(blobKeyOf(`${URL_OK}?x=1`)).toBeNull();
    expect(
      blobKeyOf("https://s.public.blob.vercel-storage.com/media/images/x.mp3"),
    ).toBeNull();
  });

  it("inspects with head() and a ranged GET of the first bytes", async () => {
    blob.head.mockResolvedValue({
      url: URL_OK,
      size: 1234,
      contentType: "image/jpeg",
      pathname: "media/images/photo-Ab12.jpg",
    });
    const fetchImpl = vi.fn(async () => new Response(JPEG, { status: 206 }));
    const storage = createBlobStorage("tok", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await storage.inspect(URL_OK);
    expect(blob.head).toHaveBeenCalledWith(URL_OK, { token: "tok" });
    expect(fetchImpl).toHaveBeenCalledWith(
      URL_OK,
      expect.objectContaining({ headers: { Range: "bytes=0-31" } }),
    );
    expect(result).toMatchObject({
      key: "media/images/photo-Ab12.jpg",
      url: URL_OK,
      info: { size: 1234, contentType: "image/jpeg" },
    });
    expect([...result!.info.head]).toEqual([...JPEG]);
  });

  it("returns null for unsafe refs without calling head()", async () => {
    const storage = createBlobStorage("tok", {
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(
      await storage.inspect("https://evil.example/media/images/a.jpg"),
    ).toBeNull();
    expect(
      await storage.inspect("media/images/2026/10/a-abcdefghij.png"),
    ).toBeNull();
    expect(blob.head).not.toHaveBeenCalled();
  });

  it("maps BlobNotFoundError to null", async () => {
    blob.head.mockRejectedValue(new blob.BlobNotFoundError("gone"));
    const storage = createBlobStorage("tok", {
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });
    expect(await storage.inspect(URL_OK)).toBeNull();
  });

  it("removes with del() and the token", async () => {
    const storage = createBlobStorage("tok");
    await storage.remove("media/images/photo-Ab12.jpg", URL_OK);
    expect(blob.del).toHaveBeenCalledWith(URL_OK, { token: "tok" });
  });
});

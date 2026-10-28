import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/lib/db";
import { NavigationSignal, resetDb, setTestSession } from "@/test/db-setup";
import { makeEditor, makeGallery, makeOwner, makePost } from "@/test/factories";
import { form } from "@/test/forms";

const blob = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  return { head: vi.fn(), del: vi.fn(), BlobNotFoundError };
});
vi.mock("@vercel/blob", () => blob);

import { deleteMediaAction, updateMediaAction } from "@/server/actions/media";
import { registerUploadAction } from "@/server/actions/uploads";
import { createLocalStorage } from "@/server/storage/local";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);
const MP3 = new TextEncoder().encode("ID3\x04\x00\x00\x00\x00");
const HTML = new TextEncoder().encode(
  "<!doctype html><script>alert(1)</script>",
);
const BLOB_URL =
  "https://store1.public.blob.vercel-storage.com/media/images/photo-Ab12.png";

let root: string;
let n = 0;
const streamOf = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });

/** Writes a fixture file with the local driver and returns its key. */
async function stored(bytes: Uint8Array, ext = "png", folder = "images") {
  n += 1;
  const key = `media/${folder}/2026/10/fixture-${String(n).padStart(10, "0")}.${ext}`;
  await createLocalStorage(root).writeStream(key, streamOf(bytes), 10_000_000);
  return key;
}
const fileExists = (key: string) =>
  existsSync(path.join(root, ...key.split("/")));
const imageForm = (ref: string, extra: Record<string, string> = {}) =>
  form({
    kind: "IMAGE",
    ref,
    titleEn: "Uploaded photo",
    altTextEn: "Two people reading a Bible",
    originalFilename: "IMG_0001 secret-name.png",
    width: "320",
    height: "240",
    ...extra,
  });

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "uploads-db-"));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_UPLOAD_DIR", root);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("VERCEL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("registerUploadAction (local driver)", () => {
  it("OWNER and EDITOR register a PNG as a draft picture; the audit row has no file name or alt text", async () => {
    for (const user of [await makeOwner(), await makeEditor()]) {
      setTestSession(user);
      const key = await stored(PNG);
      const result = await registerUploadAction(null, imageForm(key));
      expect(result).toMatchObject({
        ok: true,
        data: { url: `/api/uploads/${key}`, type: "IMAGE" },
      });
      const row = await prisma.mediaItem.findUniqueOrThrow({
        where: { storageKey: key },
      });
      expect(row).toMatchObject({
        type: "IMAGE",
        status: "DRAFT",
        storageDriver: "LOCAL",
        mimeType: "image/png",
        sizeBytes: PNG.length,
        url: `/api/uploads/${key}`,
        width: 320,
        height: 240,
        originalFilename: "IMG_0001 secret-name.png",
        galleryId: null,
      });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: "media.upload", entityId: row.id },
      });
      expect(audit.actorId).toBe(user.id);
      const meta = JSON.stringify(audit.metadata);
      expect(meta).toContain("image/png");
      expect(meta).not.toMatch(/secret-name|Two people|Uploaded photo|fixture/);
    }
  });

  it("publish=on publishes; a gallery upload is appended at the end", async () => {
    setTestSession(await makeOwner());
    const gallery = await makeGallery();
    await prisma.mediaItem.create({
      data: {
        type: "IMAGE",
        titleEn: "x",
        url: "/a.png",
        altTextEn: "a",
        galleryId: gallery.id,
        sortOrder: 4,
      },
    });
    const key = await stored(PNG);
    await registerUploadAction(
      null,
      imageForm(key, { publish: "on", galleryId: gallery.id }),
    );
    const row = await prisma.mediaItem.findUniqueOrThrow({
      where: { storageKey: key },
    });
    expect(row).toMatchObject({
      status: "PUBLISHED",
      galleryId: gallery.id,
      sortOrder: 5,
      category: "GALLERY",
    });
  });

  it("requires alt text for pictures but not for audio", async () => {
    setTestSession(await makeOwner());
    const key = await stored(PNG);
    const result = await registerUploadAction(
      null,
      imageForm(key, { altTextEn: " " }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { altTextEn: expect.any(String) },
    });
    expect(await prisma.mediaItem.count()).toBe(0);

    const audio = await stored(MP3, "mp3", "audio");
    const ok = await registerUploadAction(
      null,
      form({ kind: "AUDIO", ref: audio, titleEn: "Talk" }),
    );
    expect(ok).toMatchObject({ ok: true });
    const row = await prisma.mediaItem.findUniqueOrThrow({
      where: { storageKey: audio },
    });
    expect(row).toMatchObject({
      type: "AUDIO",
      mimeType: "audio/mpeg",
      altTextEn: null,
    });
  });

  it("an HTML file named .png is rejected and deleted", async () => {
    setTestSession(await makeOwner());
    const key = await stored(HTML);
    const result = await registerUploadAction(null, imageForm(key));
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        ref: "This file isn't a valid JPEG, PNG or WebP picture.",
      },
    });
    expect(fileExists(key)).toBe(false);
    expect(await prisma.mediaItem.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("an audio file registered as a picture is rejected", async () => {
    setTestSession(await makeOwner());
    const key = await stored(MP3, "mp3", "audio");
    const result = await registerUploadAction(null, imageForm(key));
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(fileExists(key)).toBe(false);
  });

  it("unknown keys, traversal keys and duplicates are refused", async () => {
    setTestSession(await makeOwner());
    expect(
      await registerUploadAction(
        null,
        imageForm("media/images/2026/10/nope-aaaaaaaaaa.png"),
      ),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { ref: expect.stringMatching(/not found/) },
    });
    expect(
      await registerUploadAction(
        null,
        imageForm("media/images/2026/10/../../../../package.json"),
      ),
    ).toMatchObject({ ok: false, code: "VALIDATION" });
    const key = await stored(PNG);
    expect(await registerUploadAction(null, imageForm(key))).toMatchObject({
      ok: true,
    });
    expect(await registerUploadAction(null, imageForm(key))).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(fileExists(key)).toBe(true); // the registered file is untouched
    expect(await prisma.mediaItem.count()).toBe(1);
  });

  it("an unknown gallery is a field error", async () => {
    setTestSession(await makeOwner());
    const key = await stored(PNG);
    expect(
      await registerUploadAction(
        null,
        imageForm(key, { galleryId: "no-such-gallery" }),
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: { galleryId: expect.any(String) },
    });
  });

  it("without a session nothing is written and the file is untouched", async () => {
    const key = await stored(PNG);
    expect(await registerUploadAction(null, imageForm(key))).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(await prisma.mediaItem.count()).toBe(0);
    expect(fileExists(key)).toBe(true);
  });

  it("on Vercel without a token uploads are switched off", async () => {
    vi.stubEnv("VERCEL", "1");
    setTestSession(await makeOwner());
    expect(
      await registerUploadAction(
        null,
        imageForm("media/images/2026/10/a-abcdefghij.png"),
      ),
    ).toMatchObject({
      ok: false,
      code: "CONFLICT",
      formError: "File uploads are not set up yet.",
    });
  });
});

describe("registerUploadAction (Vercel Blob driver, mocked)", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(PNG, { status: 206 })),
    );
  });

  it("registers a blob URL after checking head() and the first bytes", async () => {
    blob.head.mockResolvedValue({
      url: BLOB_URL,
      size: 1000,
      contentType: "image/png",
      pathname: "media/images/photo-Ab12.png",
    });
    setTestSession(await makeOwner());
    expect(await registerUploadAction(null, imageForm(BLOB_URL))).toMatchObject(
      { ok: true },
    );
    const row = await prisma.mediaItem.findFirstOrThrow();
    expect(row).toMatchObject({
      storageDriver: "VERCEL_BLOB",
      storageKey: "media/images/photo-Ab12.png",
      url: BLOB_URL,
      sizeBytes: 1000,
    });
    expect(blob.del).not.toHaveBeenCalled();
  });

  it("an SVG reported by Blob is rejected and deleted", async () => {
    blob.head.mockResolvedValue({
      url: BLOB_URL,
      size: 100,
      contentType: "image/svg+xml",
      pathname: "media/images/photo-Ab12.png",
    });
    setTestSession(await makeOwner());
    expect(await registerUploadAction(null, imageForm(BLOB_URL))).toMatchObject(
      { ok: false, code: "VALIDATION" },
    );
    expect(blob.del).toHaveBeenCalledWith(BLOB_URL, { token: "test-token" });
    expect(await prisma.mediaItem.count()).toBe(0);
  });

  it("a too-large blob is rejected and deleted", async () => {
    blob.head.mockResolvedValue({
      url: BLOB_URL,
      size: 8 * 1024 * 1024 + 1,
      contentType: "image/png",
      pathname: "media/images/photo-Ab12.png",
    });
    setTestSession(await makeOwner());
    expect(await registerUploadAction(null, imageForm(BLOB_URL))).toMatchObject(
      {
        ok: false,
        fieldErrors: { ref: "Pictures can be at most 8 MB." },
      },
    );
    expect(blob.del).toHaveBeenCalled();
  });

  it("a non-blob URL is refused without contacting Blob", async () => {
    setTestSession(await makeOwner());
    expect(
      await registerUploadAction(
        null,
        imageForm("https://evil.example/media/images/x.png"),
      ),
    ).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(blob.head).not.toHaveBeenCalled();
  });
});

describe("deleting and editing uploaded media", () => {
  async function upload() {
    const key = await stored(PNG);
    const result = await registerUploadAction(null, imageForm(key));
    if (!result.ok) throw new Error("upload failed");
    return { key, id: result.data!.id, url: result.data!.url };
  }

  it("deleting an uploaded item removes the row and the file", async () => {
    setTestSession(await makeOwner());
    const item = await upload();
    await expect(
      deleteMediaAction(null, form({ id: item.id })),
    ).rejects.toBeInstanceOf(NavigationSignal);
    expect(await prisma.mediaItem.count()).toBe(0);
    expect(fileExists(item.key)).toBe(false);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "media.delete" },
    });
    expect(audit.metadata).toMatchObject({ hadFile: true });
  });

  it("an item used as a post cover or the site logo can't be deleted", async () => {
    setTestSession(await makeOwner());
    const item = await upload();
    await makePost({ titleEn: "Cover post", coverImageUrl: item.url });
    await prisma.siteSettings.create({
      data: {
        id: "singleton",
        ministryName: "M",
        contactEmail: "a@example.org",
        logoUrl: item.url,
      },
    });
    const result = await deleteMediaAction(null, form({ id: item.id }));
    expect(result).toMatchObject({
      ok: false,
      code: "CONFLICT",
      formError:
        'This file is still used: site logo, cover of post "Cover post". Choose another picture there first.',
    });
    expect(await prisma.mediaItem.count()).toBe(1);
    expect(fileExists(item.key)).toBe(true);
  });

  it("deleting a VERCEL_BLOB row calls del() after the commit", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    setTestSession(await makeOwner());
    const row = await prisma.mediaItem.create({
      data: {
        type: "IMAGE",
        titleEn: "Blob photo",
        url: BLOB_URL,
        altTextEn: "Alt",
        storageDriver: "VERCEL_BLOB",
        storageKey: "media/images/photo-Ab12.png",
      },
    });
    await expect(
      deleteMediaAction(null, form({ id: row.id })),
    ).rejects.toBeInstanceOf(NavigationSignal);
    expect(blob.del).toHaveBeenCalledWith(BLOB_URL, { token: "test-token" });
  });

  it("a failing file delete still deletes the row (afterCommit errors are swallowed)", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    blob.del.mockRejectedValue(new Error("network down"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    setTestSession(await makeOwner());
    const row = await prisma.mediaItem.create({
      data: {
        type: "IMAGE",
        titleEn: "B",
        url: BLOB_URL,
        altTextEn: "Alt",
        storageDriver: "VERCEL_BLOB",
        storageKey: "media/images/photo-Ab12.png",
      },
    });
    await expect(
      deleteMediaAction(null, form({ id: row.id })),
    ).rejects.toBeInstanceOf(NavigationSignal);
    expect(await prisma.mediaItem.count()).toBe(0);
    expect(errors.mock.calls.flat().join(" ")).toMatch(
      /admin\.action\.after_commit_failed/,
    );
    errors.mockRestore();
  });

  it("a pasted-link item deletes without any storage call", async () => {
    setTestSession(await makeEditor());
    const row = await prisma.mediaItem.create({
      data: {
        type: "IMAGE",
        titleEn: "Link",
        url: "/demo/gallery/sample-1.svg",
        altTextEn: "Alt",
      },
    });
    await expect(
      deleteMediaAction(null, form({ id: row.id })),
    ).rejects.toBeInstanceOf(NavigationSignal);
    expect(blob.del).not.toHaveBeenCalled();
  });

  it("an uploaded item keeps its url and type when edited", async () => {
    setTestSession(await makeOwner());
    const item = await upload();
    const base = {
      id: item.id,
      category: "GENERAL",
      titleEn: "Renamed",
      altTextEn: "New alt",
      intent: "draft",
    };
    expect(
      await updateMediaAction(
        null,
        form({ ...base, type: "IMAGE", url: "https://evil.example/x.png" }),
      ),
    ).toMatchObject({ ok: true });
    const row = await prisma.mediaItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(row).toMatchObject({
      url: item.url,
      titleEn: "Renamed",
      altTextEn: "New alt",
    });
    expect(
      await updateMediaAction(
        null,
        form({ ...base, type: "AUDIO", url: item.url }),
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: { type: "Uploaded files keep their type." },
    });
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  acceptAttribute,
  AUDIO_MAX_BYTES,
  blobPathname,
  buildLocalKey,
  classifyUpload,
  fitWithin,
  IMAGE_MAX_BYTES,
  isBlobPathname,
  isLocalKey,
  matchesSniff,
  normalizeMime,
  safeBaseName,
  sniffMime,
  titleFromFilename,
} from "./policy";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = text("RIFF\x00\x00\x00\x00WEBPVP8 ");
const MP3_ID3 = text("ID3\x04\x00\x00");
const MP3_SYNC = bytes(0xff, 0xfb, 0x90, 0x64);
const M4A = text("\x00\x00\x00\x20ftypM4A \x00\x00");

describe("classifyUpload", () => {
  it.each([
    ["photo.jpg", "image/jpeg", "IMAGE", "jpg"],
    ["photo.JPEG", "image/jpeg", "IMAGE", "jpg"],
    ["photo.png", "image/png", "IMAGE", "png"],
    ["photo.webp", "image/webp", "IMAGE", "webp"],
    ["talk.mp3", "audio/mpeg", "AUDIO", "mp3"],
    ["talk.m4a", "audio/mp4", "AUDIO", "m4a"],
    ["talk.m4a", "audio/x-m4a", "AUDIO", "m4a"],
    ["talk.m4a", "", "AUDIO", "m4a"],
  ])("accepts %s (%s)", (filename, contentType, kind, ext) => {
    expect(classifyUpload({ filename, contentType, size: 1 })).toMatchObject({
      ok: true,
      kind,
      ext,
    });
  });

  it("accepts files exactly at the limit and rejects one byte more", () => {
    const img = { filename: "a.png", contentType: "image/png" };
    expect(classifyUpload({ ...img, size: IMAGE_MAX_BYTES }).ok).toBe(true);
    expect(classifyUpload({ ...img, size: IMAGE_MAX_BYTES + 1 })).toMatchObject(
      {
        ok: false,
        reason: "size",
        message: "Pictures can be at most 8 MB.",
      },
    );
    const mp3 = { filename: "a.mp3", contentType: "audio/mpeg" };
    expect(classifyUpload({ ...mp3, size: AUDIO_MAX_BYTES }).ok).toBe(true);
    expect(classifyUpload({ ...mp3, size: AUDIO_MAX_BYTES + 1 })).toMatchObject(
      {
        ok: false,
        reason: "size",
      },
    );
  });

  it("rejects empty files and files without a name", () => {
    expect(
      classifyUpload({ filename: "a.png", contentType: "image/png", size: 0 }),
    ).toMatchObject({ ok: false, reason: "empty" });
    expect(
      classifyUpload({ filename: "  ", contentType: "image/png", size: 5 }),
    ).toMatchObject({ ok: false, reason: "name" });
  });

  it.each([
    ["logo.svg", "image/svg+xml"],
    ["anim.gif", "image/gif"],
    ["phone.heic", "image/heic"],
    ["clip.mp4", "video/mp4"],
    ["files.zip", "application/zip"],
    ["photo.jpg.exe", "application/octet-stream"],
    ["photo.png", "image/jpeg"],
    ["noext", "image/png"],
    ["page.html", "text/html"],
  ])("rejects %s (%s) as a type error", (filename, contentType) => {
    expect(classifyUpload({ filename, contentType, size: 10 })).toMatchObject({
      ok: false,
      reason: "type",
      message:
        "Only JPEG, PNG and WebP pictures or MP3 and M4A audio can be uploaded.",
    });
  });

  it("rejects a file of the wrong kind", () => {
    expect(
      classifyUpload({
        filename: "talk.mp3",
        contentType: "audio/mpeg",
        size: 10,
        kind: "IMAGE",
      }),
    ).toMatchObject({ ok: false, reason: "kind" });
  });

  it("normalizes MIME aliases and parameters", () => {
    expect(normalizeMime("audio/x-m4a")).toBe("audio/mp4");
    expect(normalizeMime("Image/JPEG; charset=binary")).toBe("image/jpeg");
    expect(normalizeMime(null)).toBe("");
  });
});

describe("sniffMime / matchesSniff", () => {
  it.each([
    [JPEG, "image/jpeg"],
    [PNG, "image/png"],
    [WEBP, "image/webp"],
    [MP3_ID3, "audio/mpeg"],
    [MP3_SYNC, "audio/mpeg"],
    [M4A, "audio/mp4"],
  ])("detects %#", (head, mime) => {
    expect(sniffMime(head)).toBe(mime);
    expect(matchesSniff(mime, head)).toBe(true);
  });

  it("rejects HTML, SVG and mismatched headers", () => {
    expect(matchesSniff("image/png", text("<!doctype html><script>"))).toBe(
      false,
    );
    expect(
      matchesSniff(
        "image/png",
        text('<svg xmlns="http://www.w3.org/2000/svg">'),
      ),
    ).toBe(false);
    expect(matchesSniff("image/jpeg", PNG)).toBe(false);
    expect(matchesSniff("image/png", new Uint8Array())).toBe(false);
  });
});

describe("safe names and keys", () => {
  it.each([
    ["../../etc/passwd", "passwd"],
    ["C:\\x\\y.png", "y"],
    ["नेपाल.jpg", "file"],
    ["Café Photo (1).JPG", "cafe-photo-1"],
    [".hidden", "hidden"],
  ])("safeBaseName(%s) = %s", (input, out) => {
    expect(safeBaseName(input)).toBe(out);
  });

  it("caps long names at 60 characters", () => {
    expect(safeBaseName(`${"a".repeat(300)}.png`)).toHaveLength(60);
  });

  it("builds local keys that pass isLocalKey", () => {
    const key = buildLocalKey(
      "IMAGE",
      "My Photo.png",
      "png",
      new Date("2026-10-05T00:00:00Z"),
      "abcdefghij",
    );
    expect(key).toBe("media/images/2026/10/my-photo-abcdefghij.png");
    expect(isLocalKey(key)).toBe(true);
    expect(() =>
      buildLocalKey("IMAGE", "x.mp3", "mp3", new Date(), "abcdefghij"),
    ).toThrow();
    expect(() =>
      buildLocalKey("IMAGE", "x.png", "png", new Date(), "../aaaaaaa"),
    ).toThrow();
  });

  it.each([
    "media/images/2026/10/../../../x-abcdefghij.png",
    "media/images/2026/10/a\\b-abcdefghij.png",
    "media/images/2026/10/%2e%2e-abcdefghij.png",
    "/media/images/2026/10/a-abcdefghij.png",
    "media/images/2026/10/a-abcdefghij.png\u0000",
    "MEDIA/images/2026/10/a-abcdefghij.png",
    "media/images/2026/10/a-abcdefghij.mp3",
    "media/audio/2026/10/a-abcdefghij.png",
    "media/images/2026/10/a-abcdefghij.svg",
    "C:/media/images/2026/10/a-abcdefghij.png",
  ])("isLocalKey rejects %s", (key) => {
    expect(isLocalKey(key)).toBe(false);
  });

  it("validates blob pathnames", () => {
    expect(blobPathname("AUDIO", "Sermon 1.m4a", "m4a")).toBe(
      "media/audio/sermon-1.m4a",
    );
    expect(isBlobPathname("media/images/photo-AbC123xyz.jpg")).toBe(true);
    expect(isBlobPathname("media/audio/talk.mp3")).toBe(true);
    expect(isBlobPathname("media/images/x.mp3")).toBe(false);
    expect(isBlobPathname("../x.png")).toBe(false);
    expect(isBlobPathname("media/images/a/b.png")).toBe(false);
    expect(isBlobPathname("other/x.png")).toBe(false);
  });

  it("derives a title from the file name", () => {
    expect(titleFromFilename("My_photo-2026.jpg")).toBe("My photo 2026");
    expect(titleFromFilename("a/b/c.png")).toBe("c");
  });

  it("lists the allowed types for the file picker", () => {
    expect(acceptAttribute("image")).toBe(
      "image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp",
    );
    expect(acceptAttribute("image+audio")).toContain("audio/mp4,.m4a");
  });
});

describe("fitWithin", () => {
  it("scales landscape and portrait pictures and leaves small ones", () => {
    expect(fitWithin(5120, 2560)).toEqual({ width: 2560, height: 1280 });
    expect(fitWithin(3000, 6000)).toEqual({ width: 1280, height: 2560 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

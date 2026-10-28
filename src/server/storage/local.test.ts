// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createLocalStorage,
  resolveLocalPath,
  UploadTooLargeError,
} from "./local";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const KEY = "media/images/2026/10/photo-abcdefghij.png";

function stream(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

let root: string;
let outside: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "uploads-"));
  outside = await mkdtemp(path.join(os.tmpdir(), "outside-"));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("local storage driver", () => {
  it("writes, inspects and removes a file", async () => {
    const storage = createLocalStorage(root);
    expect(await storage.writeStream(KEY, stream(PNG), 1000)).toEqual({
      size: PNG.length,
    });
    const info = await storage.inspect(KEY);
    expect(info).toMatchObject({
      key: KEY,
      url: `/api/uploads/${KEY}`,
      info: { size: PNG.length, contentType: "image/png" },
    });
    expect([...info!.info.head]).toEqual([...PNG]);
    await storage.remove(KEY, info!.url);
    expect(await storage.inspect(KEY)).toBeNull();
  });

  it("never overwrites an existing file", async () => {
    const storage = createLocalStorage(root);
    const key = "media/images/2026/10/twice-abcdefghij.png";
    await storage.writeStream(key, stream(PNG), 1000);
    await expect(
      storage.writeStream(key, stream(PNG), 1000),
    ).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("stops at the byte limit and leaves no partial file", async () => {
    const storage = createLocalStorage(root);
    const key = "media/images/2026/10/big-abcdefghij.png";
    await expect(
      storage.writeStream(key, stream(PNG, new Uint8Array(100)), 50),
    ).rejects.toBeInstanceOf(UploadTooLargeError);
    expect(existsSync(path.join(root, key))).toBe(false);
  });

  it.each([
    "../x",
    "media/images/../../x.png",
    "..\\..\\x.png",
    "%2e%2e/x",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "media/images/2026/10/a\u0000-abcdefghij.png",
    "MEDIA/images/2026/10/a-abcdefghij.png",
    "media/images/2026/10/../../../../outside-abcdefghij.png",
  ])("resolveLocalPath rejects %j", (key) => {
    expect(resolveLocalPath(root, key)).toBeNull();
  });

  it("resolves a valid key inside the root", () => {
    expect(resolveLocalPath(root, KEY)).toBe(
      path.join(root, ...KEY.split("/")),
    );
  });

  // Windows needs developer mode / admin rights for symlinks.
  let symlinkOk = true;
  try {
    const probe = path.join(os.tmpdir(), `probe-${process.pid}-${Date.now()}`);
    symlinkSync(os.tmpdir(), probe, "junction");
    rmSync(probe, { force: true, recursive: true });
  } catch {
    symlinkOk = false;
  }

  it.skipIf(!symlinkOk)(
    "refuses a linked folder pointing outside the root",
    async () => {
      writeFileSync(path.join(outside, "secret-abcdefghij.png"), PNG);
      mkdirSync(path.join(root, "media", "images", "2027"), {
        recursive: true,
      });
      symlinkSync(
        outside,
        path.join(root, "media", "images", "2027", "01"),
        "junction",
      );
      const storage = createLocalStorage(root);
      const key = "media/images/2027/01/secret-abcdefghij.png";
      expect(resolveLocalPath(root, key)).not.toBeNull(); // lexically fine...
      expect(await storage.inspect(key)).toBeNull(); // ...but the real path is outside
      expect(await storage.stat(key)).toBeNull();
    },
  );
});

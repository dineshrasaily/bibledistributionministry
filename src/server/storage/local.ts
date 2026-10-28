import "server-only";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, open, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import { isLocalKey, mimeForExt } from "@/lib/uploads/policy";
import type { InspectedObject, StorageDriver } from "./types";

/**
 * Local filesystem driver (dev and tests only). Files live under `root`
 * (git-ignored .local/uploads by default) and are served by
 * /api/uploads/[...key]. Every key is server-generated and re-validated, and
 * every path is checked to stay inside `root`.
 */

export class UploadTooLargeError extends Error {
  constructor() {
    super("Upload exceeds the size limit");
    this.name = "UploadTooLargeError";
  }
}

/** Lexical check: strict key regex + resolved path inside root. Null if unsafe. */
export function resolveLocalPath(root: string, key: string): string | null {
  if (typeof key !== "string" || !isLocalKey(key)) return null;
  const base = path.resolve(/*turbopackIgnore: true*/ root);
  const full = path.resolve(/*turbopackIgnore: true*/ base, key);
  return full.startsWith(base + path.sep) ? full : null;
}

/**
 * Filesystem check for an existing file: not a symlink, and its real path
 * (following any linked parent folder) is still inside the real root.
 */
async function resolveExisting(
  root: string,
  key: string,
): Promise<string | null> {
  const full = resolveLocalPath(root, key);
  if (!full) return null;
  try {
    const info = await lstat(/*turbopackIgnore: true*/ full);
    if (info.isSymbolicLink() || !info.isFile()) return null;
    const [realRoot, realFull] = await Promise.all([
      realpath(/*turbopackIgnore: true*/ root),
      realpath(/*turbopackIgnore: true*/ full),
    ]);
    return realFull.startsWith(realRoot + path.sep) ? realFull : null;
  } catch {
    return null;
  }
}

export function localPublicUrl(key: string): string {
  return `/api/uploads/${key}`;
}

const extOf = (key: string) => key.slice(key.lastIndexOf(".") + 1);

export function createLocalStorage(root: string) {
  const base = path.resolve(/*turbopackIgnore: true*/ root);

  async function writeStream(
    key: string,
    body: ReadableStream<Uint8Array> | null,
    maxBytes: number,
  ): Promise<{ size: number }> {
    const full = resolveLocalPath(base, key);
    if (!full || !body) throw new Error("Invalid upload target");
    await mkdir(/*turbopackIgnore: true*/ path.dirname(full), {
      recursive: true,
    });
    const out = createWriteStream(/*turbopackIgnore: true*/ full, {
      flags: "wx",
    });
    await once(out, "open"); // rejects with EEXIST: never overwrite
    let size = 0;
    try {
      for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new UploadTooLargeError();
        if (!out.write(chunk)) await once(out, "drain");
      }
      out.end();
      await once(out, "finish");
      return { size };
    } catch (error) {
      out.destroy();
      await once(out, "close").catch(() => undefined);
      await rm(/*turbopackIgnore: true*/ full, { force: true });
      throw error;
    }
  }

  async function readHead(key: string, bytes = 32): Promise<Uint8Array | null> {
    const full = await resolveExisting(base, key);
    if (!full) return null;
    const handle = await open(/*turbopackIgnore: true*/ full, "r");
    try {
      const buffer = new Uint8Array(bytes);
      const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async function statKey(
    key: string,
  ): Promise<{ size: number; path: string } | null> {
    const full = await resolveExisting(base, key);
    if (!full) return null;
    const info = await stat(/*turbopackIgnore: true*/ full);
    return { size: info.size, path: full };
  }

  async function remove(key: string): Promise<void> {
    const full = resolveLocalPath(base, key);
    if (!full) return;
    await rm(/*turbopackIgnore: true*/ full, { force: true });
  }

  async function inspect(ref: string): Promise<InspectedObject | null> {
    const info = await statKey(ref);
    if (!info) return null;
    const head = (await readHead(ref)) ?? new Uint8Array();
    return {
      key: ref,
      url: localPublicUrl(ref),
      info: { size: info.size, contentType: mimeForExt(extOf(ref)), head },
    };
  }

  const driver: StorageDriver & {
    root: string;
    writeStream: typeof writeStream;
    readHead: typeof readHead;
    stat: typeof statKey;
    publicUrl: typeof localPublicUrl;
  } = {
    name: "LOCAL",
    root: base,
    writeStream,
    readHead,
    stat: statKey,
    publicUrl: localPublicUrl,
    inspect,
    remove: (key) => remove(key),
  };
  return driver;
}

export type LocalStorage = ReturnType<typeof createLocalStorage>;

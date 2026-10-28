import "server-only";
import { BlobNotFoundError, del, head } from "@vercel/blob";
import { isBlobUrl } from "@/lib/image-src";
import { isBlobPathname } from "@/lib/uploads/policy";
import type { InspectedObject, StorageDriver } from "./types";

/** Blob pathname of a public Vercel Blob URL when it passes the strict rules, else null. */
export function blobKeyOf(url: string): string | null {
  if (!isBlobUrl(url)) return null;
  const parsed = new URL(url);
  if (parsed.search !== "" || parsed.hash !== "") return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return null;
  }
  return isBlobPathname(pathname) ? pathname : null;
}

/**
 * Vercel Blob driver (production). The browser uploads straight to Blob with
 * a short-lived client token; the server re-inspects the object (size, type,
 * first bytes) before registering it, and deletes it with the RW token.
 */
export function createBlobStorage(
  token: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): StorageDriver {
  async function inspect(ref: string): Promise<InspectedObject | null> {
    const key = blobKeyOf(ref);
    if (!key) return null;
    let meta: Awaited<ReturnType<typeof head>>;
    try {
      meta = await head(ref, { token });
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
    if (blobKeyOf(meta.url) !== key) return null;
    const res = await fetchImpl(meta.url, {
      headers: { Range: "bytes=0-31" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer()).subarray(0, 32);
    return {
      key,
      url: meta.url,
      info: {
        size: meta.size,
        contentType: meta.contentType ?? null,
        head: bytes,
      },
    };
  }

  return {
    name: "VERCEL_BLOB",
    inspect,
    remove: (_key, url) => del(url, { token }),
  };
}

import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { mimeForExt } from "@/lib/uploads/policy";
import { getLocalStorage, getStorageMode } from "@/server/storage";

/**
 * Serves locally stored uploads (local driver only; 404 in blob/disabled
 * mode). Keys must pass the strict key rules and stay inside the upload
 * folder; anything else is a plain 404 so nothing leaks.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ key: string[] }> };

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function parseRange(
  header: string,
  size: number,
): { start: number; end: number } | null | "invalid" {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= size
  ) {
    return "invalid";
  }
  return { start, end };
}

async function serve(request: Request, context: Context, withBody: boolean) {
  if (getStorageMode() !== "local") return notFound();
  const { key: segments } = await context.params;
  if (!Array.isArray(segments) || segments.length === 0) return notFound();
  const key = segments.join("/");
  const storage = getLocalStorage();
  const file = await storage.stat(key);
  if (!file) return notFound();
  const contentType = mimeForExt(key.slice(key.lastIndexOf(".") + 1));
  if (!contentType) return notFound();

  const headers = new Headers({
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  });

  const rangeHeader = request.headers.get("range");
  let start = 0;
  let end = file.size - 1;
  let status = 200;
  if (rangeHeader) {
    const range = parseRange(rangeHeader, file.size);
    if (range === "invalid" || range === null) {
      headers.set("Content-Range", `bytes */${file.size}`);
      return new Response(null, { status: 416, headers });
    }
    ({ start, end } = range);
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
  }
  headers.set("Content-Length", String(file.size === 0 ? 0 : end - start + 1));
  if (!withBody || file.size === 0)
    return new Response(null, { status, headers });
  const stream = Readable.toWeb(
    createReadStream(/*turbopackIgnore: true*/ file.path, { start, end }),
  ) as ReadableStream;
  return new Response(stream, { status, headers });
}

export function GET(request: Request, context: Context) {
  return serve(request, context, true);
}

export function HEAD(request: Request, context: Context) {
  return serve(request, context, false);
}

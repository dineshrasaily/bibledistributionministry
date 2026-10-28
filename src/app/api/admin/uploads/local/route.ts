import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { log } from "@/lib/log";
import {
  buildLocalKey,
  classifyUpload,
  MAX_BYTES,
  matchesSniff,
  UPLOAD_MESSAGES,
} from "@/lib/uploads/policy";
import { requireAdminRoute } from "@/server/auth/route-guard";
import { recordAdminAudit } from "@/server/services/audit";
import { getLocalStorage, getStorageMode } from "@/server/storage";
import { UploadTooLargeError } from "@/server/storage/local";

/**
 * Local-driver upload (dev/tests only): the raw file body is streamed to
 * .local/uploads with a byte cap. The file is not in the library until the
 * guarded registerUploadAction re-checks and registers it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: NO_STORE });

const kindSchema = z.enum(["IMAGE", "AUDIO"]);
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const random10 = () =>
  Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    "",
  );

export async function POST(request: NextRequest) {
  const guard = await requireAdminRoute(request, { mutation: true });
  if (guard instanceof Response) return guard;
  if (getStorageMode() !== "local")
    return json(503, { error: "UPLOADS_DISABLED" });

  const kind = kindSchema.safeParse(request.nextUrl.searchParams.get("kind"));
  if (!kind.success) return json(400, { error: "KIND" });

  let filename: string;
  try {
    filename = decodeURIComponent(request.headers.get("x-file-name") ?? "");
  } catch {
    return json(400, { error: "NAME", message: UPLOAD_MESSAGES.name });
  }
  if (filename.length > 200) {
    return json(400, { error: "NAME", message: UPLOAD_MESSAGES.name });
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader === null) return json(411, { error: "LENGTH_REQUIRED" });
  const length = Number(lengthHeader);
  if (!Number.isSafeInteger(length) || length < 0) {
    return json(400, { error: "LENGTH" });
  }

  const check = classifyUpload({
    filename,
    contentType: request.headers.get("content-type"),
    size: length,
    kind: kind.data,
  });
  if (!check.ok) {
    return json(check.reason === "size" ? 413 : 415, {
      error: check.reason.toUpperCase(),
      message: check.message,
    });
  }

  const storage = getLocalStorage();
  const key = buildLocalKey(
    check.kind,
    filename,
    check.ext,
    new Date(),
    random10(),
  );
  let size: number;
  try {
    ({ size } = await storage.writeStream(
      key,
      request.body,
      Math.min(length, MAX_BYTES[check.kind]),
    ));
  } catch (error) {
    if (error instanceof UploadTooLargeError) {
      return json(413, {
        error: "SIZE",
        message: UPLOAD_MESSAGES.size[check.kind],
      });
    }
    log.error("upload.local.write_failed", { name: (error as Error)?.name });
    return json(500, { error: "ERROR" });
  }

  const head = await storage.readHead(key);
  if (size === 0 || !head || !matchesSniff(check.mime, head)) {
    await storage.remove(key, storage.publicUrl(key));
    return json(415, {
      error: "TYPE",
      message:
        size === 0
          ? UPLOAD_MESSAGES.empty
          : UPLOAD_MESSAGES.invalidContent[check.kind],
    });
  }

  await recordAdminAudit({
    actor: guard,
    action: "media.file.store",
    entityType: "MediaItem",
    metadata: {
      kind: check.kind,
      mimeType: check.mime,
      sizeBytes: size,
      driver: "LOCAL",
    },
  });
  return json(201, {
    key,
    url: storage.publicUrl(key),
    size,
    mime: check.mime,
  });
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { log } from "@/lib/log";
import {
  isBlobPathname,
  kindOfKey,
  MAX_BYTES,
  mimesOf,
} from "@/lib/uploads/policy";
import { blobClientPayloadSchema } from "@/lib/validation/uploads";
import { requireAdmin } from "@/server/auth/guards";
import { requireAdminRoute } from "@/server/auth/route-guard";
import { recordAdminAudit } from "@/server/services/audit";
import { getStorageMode } from "@/server/storage";

/**
 * Vercel Blob client-upload token route. Only "generate client token"
 * requests are accepted (no unauthenticated upload-completed callback): the
 * browser registers the file through the guarded registerUploadAction.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: NO_STORE });

class TokenRequestError extends Error {}

export async function POST(request: NextRequest) {
  if (getStorageMode() !== "blob") return json(404, { error: "NOT_FOUND" });

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json(400, { error: "Invalid upload request." });
  }
  if (body?.type !== "blob.generate-client-token") {
    return json(400, { error: "Invalid upload request." });
  }

  const guard = await requireAdminRoute(request, { mutation: true });
  if (guard instanceof Response) return guard;

  try {
    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        const actor = await requireAdmin();
        let payload: unknown;
        try {
          payload = JSON.parse(clientPayload ?? "null");
        } catch {
          throw new TokenRequestError("payload");
        }
        const parsed = blobClientPayloadSchema.safeParse(payload);
        if (!parsed.success) throw new TokenRequestError("payload");
        const kind = parsed.data.kind;
        if (!isBlobPathname(pathname) || kindOfKey(pathname) !== kind) {
          throw new TokenRequestError("pathname");
        }
        await recordAdminAudit({
          actor,
          action: "media.upload.token",
          entityType: "MediaItem",
          metadata: { kind, multipart },
        });
        return {
          allowedContentTypes: [
            ...mimesOf(kind),
            ...(kind === "AUDIO" ? ["audio/x-m4a"] : []),
          ],
          maximumSizeInBytes: MAX_BYTES[kind],
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 31_536_000,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return json(200, result);
  } catch (error) {
    log.warn("upload.blob.token_rejected", { name: (error as Error)?.name });
    return json(400, { error: "The upload could not be started." });
  }
}

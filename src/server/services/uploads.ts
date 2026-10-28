import "server-only";
import { prisma } from "@/lib/db";
import { sanitizeSingleLine } from "@/lib/sanitize-text";
import {
  ALLOWED,
  isLocalKey,
  kindOfKey,
  MAX_BYTES,
  matchesSniff,
  normalizeMime,
  mimeForExt,
  UPLOAD_MESSAGES,
} from "@/lib/uploads/policy";
import { MAX_GALLERY_ITEMS } from "@/lib/validation/galleries";
import type { RegisterUploadInput } from "@/lib/validation/uploads";
import { DomainError } from "@/server/errors";
import { getStorage } from "@/server/storage";
import type { StorageDriverName } from "@/server/storage/types";
import { blobKeyOf } from "@/server/storage/vercel-blob";
import type { ServiceResult, Tx } from "./shared";

export const UPLOADS_DISABLED_MSG = "File uploads are not set up yet.";
export const UPLOAD_NOT_FOUND_MSG =
  "The uploaded file was not found. Upload it again.";
export const UPLOAD_DUPLICATE_MSG = "This file is already in the library.";
export const GALLERY_GONE_MSG =
  "The selected gallery no longer exists. Refresh and try again.";
export const GALLERY_FULL_MSG = `A gallery can hold at most ${MAX_GALLERY_ITEMS} pictures.`;

export type PreparedUpload = RegisterUploadInput & {
  driver: StorageDriverName;
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Runs before the transaction (file/network checks must not hold a DB
 * transaction open): re-inspects the stored object server-side (kind, size,
 * declared type, magic bytes). A file that fails is deleted again.
 */
export async function prepareUpload(
  input: RegisterUploadInput,
): Promise<PreparedUpload> {
  const storage = getStorage();
  if (!storage) throw new DomainError("CONFLICT", UPLOADS_DISABLED_MSG);

  const refOk =
    storage.name === "LOCAL"
      ? isLocalKey(input.ref)
      : blobKeyOf(input.ref) !== null;
  if (!refOk) throw new DomainError("VALIDATION", UPLOAD_NOT_FOUND_MSG, "ref");

  const object = await storage.inspect(input.ref);
  if (!object) throw new DomainError("VALIDATION", UPLOAD_NOT_FOUND_MSG, "ref");

  // Before any delete below: never touch a file that is already registered.
  const existing = await prisma.mediaItem.findUnique({
    where: { storageKey: object.key },
    select: { id: true },
  });
  if (existing) throw new DomainError("CONFLICT", UPLOAD_DUPLICATE_MSG, "ref");

  const reject = async (message: string): Promise<never> => {
    await storage.remove(object.key, object.url);
    throw new DomainError("VALIDATION", message, "ref");
  };

  const kind = input.kind;
  const ext = object.key.slice(object.key.lastIndexOf(".") + 1);
  const extMime = mimeForExt(ext);
  const mime =
    storage.name === "LOCAL" ? extMime : normalizeMime(object.info.contentType);
  if (kindOfKey(object.key) !== kind) {
    await reject(UPLOAD_MESSAGES.invalidContent[kind]);
  }
  if (object.info.size <= 0) await reject(UPLOAD_MESSAGES.empty);
  if (object.info.size > MAX_BYTES[kind])
    await reject(UPLOAD_MESSAGES.size[kind]);
  if (
    !mime ||
    !(mime in ALLOWED[kind]) ||
    mime !== extMime ||
    !matchesSniff(mime, object.info.head)
  ) {
    await reject(UPLOAD_MESSAGES.invalidContent[kind]);
  }

  if (input.galleryId) {
    const gallery = await prisma.gallery.findUnique({
      where: { id: input.galleryId },
      select: { id: true },
    });
    if (!gallery)
      throw new DomainError("VALIDATION", GALLERY_GONE_MSG, "galleryId");
  }

  return {
    ...input,
    driver: storage.name,
    key: object.key,
    url: object.url,
    mimeType: mime!,
    sizeBytes: object.info.size,
  };
}

export type UploadedMedia = {
  id: string;
  url: string;
  titleEn: string;
  altTextEn: string | null;
  type: "IMAGE" | "AUDIO";
};

/** Creates the MediaItem of a prepared upload (draft unless `publish`). */
export async function createUploadedMedia(
  tx: Tx,
  input: PreparedUpload,
): Promise<ServiceResult<UploadedMedia>> {
  let sortOrder = 0;
  if (input.galleryId) {
    const agg = await tx.mediaItem.aggregate({
      where: { galleryId: input.galleryId },
      _max: { sortOrder: true },
      _count: { _all: true },
    });
    if (agg._count._all >= MAX_GALLERY_ITEMS) {
      throw new DomainError("LIMIT", GALLERY_FULL_MSG);
    }
    sortOrder = agg._count._all === 0 ? 0 : (agg._max.sortOrder ?? 0) + 1;
  }
  const isImage = input.kind === "IMAGE";
  const item = await tx.mediaItem.create({
    data: {
      type: input.kind,
      category: input.galleryId ? "GALLERY" : "GENERAL",
      titleEn: input.titleEn,
      titleNe: input.titleNe,
      url: input.url,
      altTextEn: isImage ? input.altTextEn : null,
      altTextNe: isImage ? input.altTextNe : null,
      storageDriver: input.driver,
      storageKey: input.key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: isImage ? input.width : null,
      height: isImage ? input.height : null,
      originalFilename: input.originalFilename
        ? sanitizeSingleLine(input.originalFilename).slice(0, 200) || null
        : null,
      galleryId: input.galleryId,
      sortOrder,
      status: input.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: new Date(),
    },
    select: { id: true, url: true, titleEn: true, altTextEn: true, type: true },
  });
  return {
    entityId: item.id,
    // Ids, types and sizes only: never file names, titles or alt text.
    metadata: {
      type: input.kind,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      driver: input.driver,
      inGallery: input.galleryId !== null,
      status: input.publish ? "PUBLISHED" : "DRAFT",
    },
    data: {
      id: item.id,
      url: item.url ?? input.url,
      titleEn: item.titleEn,
      altTextEn: item.altTextEn,
      type: input.kind,
    },
  };
}

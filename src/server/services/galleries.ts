import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ContentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { isSafeUrl } from "@/lib/validation/common";
import {
  MAX_GALLERY_ITEMS,
  type GalleryAddItemsInput,
  type GalleryInput,
  type GalleryMoveInput,
  type GalleryRemoveItemInput,
  type GalleryStatusInput,
  type UpdateGalleryInput,
} from "@/lib/validation/galleries";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import { DomainError } from "@/server/errors";
import {
  changedFields,
  ilike,
  paginate,
  type ServiceResult,
  type Tx,
} from "./shared";

export const EVENT_GONE_MSG =
  "The selected event no longer exists. Refresh and try again.";
export const NOT_A_PICTURE_MSG =
  "Only pictures with a description can be added.";
export const GALLERY_FULL_MSG = `A gallery can hold at most ${MAX_GALLERY_ITEMS} pictures.`;
export const NOT_IN_GALLERY_MSG =
  "This picture is not in this gallery any more. Refresh the page.";

export type GalleryListQuery = {
  q?: string;
  page: number;
  status?: ContentStatus;
};

export function listGalleries(query: GalleryListQuery) {
  const where: Prisma.GalleryWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? { OR: [{ titleEn: ilike(query.q) }, { titleNe: ilike(query.q) }] }
      : {}),
  };
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.gallery.count({ where }),
    ({ skip, take }) =>
      prisma.gallery.findMany({
        where,
        select: {
          id: true,
          titleEn: true,
          status: true,
          isDemo: true,
          updatedAt: true,
          event: { select: { id: true, titleEn: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

export function getGallery(id: string) {
  return prisma.gallery.findUnique({
    where: { id },
    include: {
      event: {
        select: { id: true, titleEn: true, slug: true, publishStatus: true },
      },
      items: {
        select: {
          id: true,
          titleEn: true,
          url: true,
          altTextEn: true,
          status: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "asc" }, { id: "asc" }],
      },
    },
  });
}

/** Galleries linked to one event (event editor). */
export function listGalleriesForEvent(eventId: string) {
  return prisma.gallery.findMany({
    where: { eventId },
    select: {
      id: true,
      titleEn: true,
      status: true,
      _count: { select: { items: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function assertEventExists(tx: Tx, eventId: string | null) {
  if (eventId == null) return;
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) throw new DomainError("VALIDATION", EVENT_GONE_MSG, "eventId");
}

function columns(input: GalleryInput) {
  return {
    titleEn: input.titleEn,
    titleNe: input.titleNe,
    descriptionEn: input.descriptionEn,
    descriptionNe: input.descriptionNe,
    eventId: input.eventId,
    status: (input.intent === "publish"
      ? "PUBLISHED"
      : "DRAFT") as ContentStatus,
  };
}

export async function createGallery(
  tx: Tx,
  input: GalleryInput,
): Promise<ServiceResult<{ id: string }>> {
  await assertEventExists(tx, input.eventId);
  const data = columns(input);
  const gallery = await tx.gallery.create({
    data: {
      ...data,
      publishedAt: data.status === "PUBLISHED" ? new Date() : null,
    },
    select: { id: true },
  });
  return {
    entityId: gallery.id,
    metadata: { status: data.status, linkedEvent: input.eventId !== null },
    data: { id: gallery.id },
  };
}

export async function updateGallery(
  tx: Tx,
  input: UpdateGalleryInput,
): Promise<ServiceResult> {
  const existing = await tx.gallery.findUniqueOrThrow({
    where: { id: input.id },
  });
  await assertEventExists(tx, input.eventId);
  const data = columns(input);
  await tx.gallery.update({
    where: { id: input.id },
    data: {
      ...data,
      publishedAt:
        existing.publishedAt ??
        (data.status === "PUBLISHED" ? new Date() : null),
    },
  });
  return {
    entityId: input.id,
    metadata: {
      changed: changedFields(existing, data),
      ...(existing.status !== data.status
        ? { status: { from: existing.status, to: data.status } }
        : {}),
    },
  };
}

export async function setGalleryStatus(
  tx: Tx,
  input: GalleryStatusInput,
): Promise<ServiceResult> {
  const existing = await tx.gallery.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true, publishedAt: true },
  });
  await tx.gallery.update({
    where: { id: input.id },
    data: {
      status: input.status,
      publishedAt:
        existing.publishedAt ??
        (input.status === "PUBLISHED" ? new Date() : null),
    },
  });
  return {
    entityId: input.id,
    metadata: { status: { from: existing.status, to: input.status } },
  };
}

/** Deletes a gallery; its photos stay in the library (galleryId -> null). */
export async function deleteGallery(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const items = await tx.mediaItem.count({ where: { galleryId: input.id } });
  await tx.gallery.delete({ where: { id: input.id } });
  return { entityId: input.id, metadata: { items } };
}

/** Renumbers a gallery's items 0..n-1 in their current order. */
async function renumber(tx: Tx, galleryId: string, orderedIds: string[]) {
  for (const [i, id] of orderedIds.entries()) {
    await tx.mediaItem.update({
      where: { id },
      data: { sortOrder: i, galleryId },
    });
  }
}

async function orderedItemIds(tx: Tx, galleryId: string): Promise<string[]> {
  const rows = await tx.mediaItem.findMany({
    where: { galleryId },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "asc" }, { id: "asc" }],
  });
  return rows.map((r) => r.id);
}

export async function addGalleryItems(
  tx: Tx,
  input: GalleryAddItemsInput,
): Promise<ServiceResult> {
  await tx.gallery.findUniqueOrThrow({
    where: { id: input.galleryId },
    select: { id: true },
  });
  const media = await tx.mediaItem.findMany({
    where: { id: { in: input.mediaIds } },
    select: {
      id: true,
      type: true,
      url: true,
      altTextEn: true,
      galleryId: true,
    },
  });
  if (media.length !== input.mediaIds.length) {
    throw new DomainError(
      "NOT_FOUND",
      "One of the pictures no longer exists. Refresh the list.",
    );
  }
  for (const m of media) {
    if (
      m.type !== "IMAGE" ||
      !m.url ||
      !isSafeUrl(m.url) ||
      !m.altTextEn?.trim()
    ) {
      throw new DomainError("VALIDATION", NOT_A_PICTURE_MSG, "mediaIds");
    }
  }
  const current = await orderedItemIds(tx, input.galleryId);
  const adding = input.mediaIds.filter((id) => !current.includes(id));
  if (current.length + adding.length > MAX_GALLERY_ITEMS) {
    throw new DomainError("LIMIT", GALLERY_FULL_MSG);
  }
  const moved = media.filter(
    (m) =>
      adding.includes(m.id) &&
      m.galleryId !== null &&
      m.galleryId !== input.galleryId,
  ).length;
  await renumber(tx, input.galleryId, [...current, ...adding]);
  if (adding.length > 0) {
    await tx.mediaItem.updateMany({
      where: { id: { in: adding } },
      data: { category: "GALLERY" },
    });
  }
  return {
    entityId: input.galleryId,
    metadata: { added: adding.length, moved },
  };
}

export async function moveGalleryItem(
  tx: Tx,
  input: GalleryMoveInput,
): Promise<ServiceResult<{ moved: boolean }>> {
  const ids = await orderedItemIds(tx, input.galleryId);
  const at = ids.indexOf(input.mediaId);
  if (at === -1) throw new DomainError("NOT_FOUND", NOT_IN_GALLERY_MSG);
  const to = input.direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= ids.length) {
    return {
      entityId: input.galleryId,
      metadata: { moved: false },
      data: { moved: false },
    };
  }
  [ids[at], ids[to]] = [ids[to]!, ids[at]!];
  await renumber(tx, input.galleryId, ids);
  return {
    entityId: input.galleryId,
    metadata: {
      mediaId: input.mediaId,
      direction: input.direction,
      moved: true,
    },
    data: { moved: true },
  };
}

export async function removeGalleryItem(
  tx: Tx,
  input: GalleryRemoveItemInput,
): Promise<ServiceResult> {
  const result = await tx.mediaItem.updateMany({
    where: { id: input.mediaId, galleryId: input.galleryId },
    data: { galleryId: null, sortOrder: 0 },
  });
  if (result.count === 0)
    throw new DomainError("NOT_FOUND", NOT_IN_GALLERY_MSG);
  await renumber(
    tx,
    input.galleryId,
    await orderedItemIds(tx, input.galleryId),
  );
  return { entityId: input.galleryId, metadata: { mediaId: input.mediaId } };
}

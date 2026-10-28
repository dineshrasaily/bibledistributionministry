import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ContentStatus,
  MediaCategory,
  MediaType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { isSafeUrl } from "@/lib/validation/common";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import type { LibraryQuery } from "@/lib/validation/uploads";
import { DomainError } from "@/server/errors";
import type { StoredFile } from "@/server/storage";
import type {
  MediaInput,
  MediaStatusInput,
  UpdateMediaInput,
} from "@/lib/validation/media";
import {
  changedFields,
  ilike,
  paginate,
  type ServiceResult,
  type Tx,
} from "./shared";

export type MediaListQuery = {
  q?: string;
  page: number;
  type?: MediaType;
  status?: ContentStatus;
  category?: MediaCategory;
  /** "upload": stored files only; "link": pasted links only. */
  source?: "upload" | "link";
};

export function listMedia(query: MediaListQuery) {
  const where: Prisma.MediaItemWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.source === "upload" ? { storageKey: { not: null } } : {}),
    ...(query.source === "link" ? { storageKey: null } : {}),
    ...(query.q
      ? { OR: [{ titleEn: ilike(query.q) }, { titleNe: ilike(query.q) }] }
      : {}),
  };
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.mediaItem.count({ where }),
    ({ skip, take }) =>
      prisma.mediaItem.findMany({
        where,
        select: {
          id: true,
          type: true,
          category: true,
          titleEn: true,
          url: true,
          thumbnailUrl: true,
          altTextEn: true,
          storageDriver: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          isFeatured: true,
          isDemo: true,
          publishedAt: true,
          updatedAt: true,
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

export const LIBRARY_PAGE_SIZE = 24;

export type LibraryItem = {
  id: string;
  title: string;
  url: string;
  alt: string | null;
  altNe: string | null;
  status: ContentStatus;
  uploaded: boolean;
  width: number | null;
  height: number | null;
};

/** Picker page: pictures (or audio) with a link, newest first; drafts included. */
export async function listLibrary(query: LibraryQuery) {
  const where: Prisma.MediaItemWhereInput = {
    type: query.kind === "audio" ? "AUDIO" : "IMAGE",
    url: { not: null },
    ...(query.q
      ? {
          OR: [
            { titleEn: ilike(query.q) },
            { titleNe: ilike(query.q) },
            { altTextEn: ilike(query.q) },
          ],
        }
      : {}),
  };
  const page = await paginate(
    query.page,
    LIBRARY_PAGE_SIZE,
    () => prisma.mediaItem.count({ where }),
    ({ skip, take }) =>
      prisma.mediaItem.findMany({
        where,
        select: {
          id: true,
          titleEn: true,
          url: true,
          altTextEn: true,
          altTextNe: true,
          status: true,
          storageKey: true,
          width: true,
          height: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
  const items: LibraryItem[] = page.items.flatMap((m) =>
    m.url && isSafeUrl(m.url)
      ? [
          {
            id: m.id,
            title: m.titleEn,
            url: m.url,
            alt: m.altTextEn,
            altNe: m.altTextNe,
            status: m.status,
            uploaded: m.storageKey !== null,
            width: m.width,
            height: m.height,
          },
        ]
      : [],
  );
  return { items, page: page.page, pageCount: page.pageCount };
}

export function getMedia(id: string) {
  return prisma.mediaItem.findUnique({ where: { id } });
}

/** Type-specific columns; fields that don't apply to the type are cleared. */
function typeColumns(input: MediaInput) {
  switch (input.type) {
    case "IMAGE":
      return {
        type: input.type,
        url: input.url,
        embedUrl: null,
        altTextEn: input.altTextEn,
        altTextNe: input.altTextNe,
      };
    case "AUDIO":
      return {
        type: input.type,
        url: input.url,
        embedUrl: null,
        altTextEn: null,
        altTextNe: null,
      };
    case "VIDEO_EMBED":
      return {
        type: input.type,
        url: null,
        embedUrl: input.embedUrl,
        altTextEn: null,
        altTextNe: null,
      };
  }
}

function commonColumns(input: MediaInput) {
  return {
    category: input.category,
    sortOrder: input.sortOrder,
    titleEn: input.titleEn,
    titleNe: input.titleNe,
    descriptionEn: input.descriptionEn,
    descriptionNe: input.descriptionNe,
    durationMinutes: input.durationMinutes,
    thumbnailUrl: input.thumbnailUrl,
    isFeatured: input.isFeatured,
    status: (input.intent === "publish"
      ? "PUBLISHED"
      : "DRAFT") as ContentStatus,
  };
}

export async function createMedia(
  tx: Tx,
  input: MediaInput,
): Promise<ServiceResult<{ id: string }>> {
  const data = {
    ...commonColumns(input),
    ...typeColumns(input),
    publishedAt: input.publishedAt ?? new Date(),
  };
  const item = await tx.mediaItem.create({ data, select: { id: true } });
  return {
    entityId: item.id,
    metadata: { type: data.type, status: data.status },
    data: { id: item.id },
  };
}

export const UPLOADED_TYPE_MSG = "Uploaded files keep their type.";

/**
 * Empty publishedAt keeps the stored date. Uploaded files keep their type
 * and URL (they always point at the stored file).
 */
export async function updateMedia(
  tx: Tx,
  input: UpdateMediaInput,
): Promise<ServiceResult> {
  const existing = await tx.mediaItem.findUniqueOrThrow({
    where: { id: input.id },
  });
  if (existing.storageKey != null && input.type !== existing.type) {
    throw new DomainError("VALIDATION", UPLOADED_TYPE_MSG, "type");
  }
  const columns = typeColumns(input);
  const data = {
    ...commonColumns(input),
    ...columns,
    ...(existing.storageKey != null ? { url: existing.url } : {}),
    publishedAt: input.publishedAt ?? existing.publishedAt,
  };
  await tx.mediaItem.update({ where: { id: input.id }, data });
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

export async function setMediaStatus(
  tx: Tx,
  input: MediaStatusInput,
): Promise<ServiceResult> {
  const existing = await tx.mediaItem.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true },
  });
  await tx.mediaItem.update({
    where: { id: input.id },
    data: { status: input.status },
  });
  return {
    entityId: input.id,
    metadata: { status: { from: existing.status, to: input.status } },
  };
}

const MAX_USAGE_LABELS = 3;

/**
 * Where a stored file's URL is still used (labels with content titles only),
 * at most 3. Checked before an uploaded file is deleted.
 */
export async function findMediaUsages(
  tx: Tx,
  url: string,
  selfId: string,
): Promise<string[]> {
  const [posts, events, settings, media] = await Promise.all([
    tx.post.findMany({
      where: { coverImageUrl: url },
      select: { titleEn: true },
      orderBy: { id: "asc" },
      take: MAX_USAGE_LABELS,
    }),
    tx.event.findMany({
      where: { coverImageUrl: url },
      select: { titleEn: true },
      orderBy: { id: "asc" },
      take: MAX_USAGE_LABELS,
    }),
    tx.siteSettings.findMany({
      where: { OR: [{ logoUrl: url }, { aboutImageUrl: url }] },
      select: { logoUrl: true, aboutImageUrl: true },
    }),
    tx.mediaItem.findMany({
      where: { thumbnailUrl: url, id: { not: selfId } },
      select: { titleEn: true },
      orderBy: { id: "asc" },
      take: MAX_USAGE_LABELS,
    }),
  ]);
  const labels = [
    ...settings.flatMap((s) => [
      ...(s.logoUrl === url ? ["site logo"] : []),
      ...(s.aboutImageUrl === url ? ["About page photo"] : []),
    ]),
    ...posts.map((p) => `cover of post "${p.titleEn}"`),
    ...events.map((e) => `cover of event "${e.titleEn}"`),
    ...media.map((m) => `thumbnail of media "${m.titleEn}"`),
  ];
  return labels.slice(0, MAX_USAGE_LABELS);
}

export const inUseMessage = (labels: string[]) =>
  `This file is still used: ${labels.join(", ")}. Choose another picture there first.`;

export type DeletedMedia = { stored: StoredFile | null };

/**
 * Deletes a media item. An uploaded file still used as a cover, logo, About
 * photo or thumbnail is refused (nothing is deleted). The stored file itself
 * is removed after the commit by the action (afterCommit).
 */
export async function deleteMedia(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult<DeletedMedia>> {
  const existing = await tx.mediaItem.findUniqueOrThrow({
    where: { id: input.id },
    select: {
      id: true,
      titleEn: true,
      url: true,
      storageDriver: true,
      storageKey: true,
    },
  });
  const stored =
    existing.storageKey != null &&
    existing.storageDriver != null &&
    existing.url != null
      ? {
          driver: existing.storageDriver,
          key: existing.storageKey,
          url: existing.url,
        }
      : null;
  if (stored) {
    const usages = await findMediaUsages(tx, stored.url, existing.id);
    if (usages.length > 0) {
      throw new DomainError("CONFLICT", inUseMessage(usages));
    }
  }
  await tx.mediaItem.delete({ where: { id: existing.id } });
  return {
    entityId: existing.id,
    metadata: { titleEn: existing.titleEn, hadFile: stored !== null },
    data: { stored },
  };
}

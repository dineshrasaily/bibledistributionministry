import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ContentStatus,
  MediaCategory,
  MediaType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/validation/list-query";
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
};

export function listMedia(query: MediaListQuery) {
  const where: Prisma.MediaItemWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
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

/** Empty publishedAt keeps the stored date. */
export async function updateMedia(
  tx: Tx,
  input: UpdateMediaInput,
): Promise<ServiceResult> {
  const existing = await tx.mediaItem.findUniqueOrThrow({
    where: { id: input.id },
  });
  const data = {
    ...commonColumns(input),
    ...typeColumns(input),
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

export async function deleteMedia(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const item = await tx.mediaItem.delete({
    where: { id: input.id },
    select: { id: true, titleEn: true },
  });
  return { entityId: item.id, metadata: { titleEn: item.titleEn } };
}

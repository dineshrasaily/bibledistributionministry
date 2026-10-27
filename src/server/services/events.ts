import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ContentStatus,
  EventKind,
  EventStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type {
  EventInput,
  EventPublishInput,
  UpdateEventInput,
} from "@/lib/validation/events";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import {
  changedFields,
  ilike,
  paginate,
  type ServiceResult,
  type Tx,
} from "./shared";

export type EventListQuery = {
  q?: string;
  page: number;
  kind?: EventKind;
  /** Lifecycle status (UPCOMING / COMPLETED / CANCELLED). */
  status?: EventStatus;
};

export function listEvents(query: EventListQuery) {
  const where: Prisma.EventWhereInput = {
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { titleEn: ilike(query.q) },
            { titleNe: ilike(query.q) },
            { slug: ilike(query.q) },
            { locationEn: ilike(query.q) },
          ],
        }
      : {}),
  };
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.event.count({ where }),
    ({ skip, take }) =>
      prisma.event.findMany({
        where,
        select: {
          id: true,
          kind: true,
          slug: true,
          titleEn: true,
          startsAt: true,
          status: true,
          publishStatus: true,
          isDemo: true,
          updatedAt: true,
        },
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

export function getEvent(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

/** Options for the media editor's "Linked mission/event" select. */
export function listEventOptions() {
  return prisma.event.findMany({
    select: { id: true, titleEn: true, startsAt: true },
    orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    take: 200,
  });
}

function publishFor(intent: EventInput["intent"]): ContentStatus {
  return intent === "publish" ? "PUBLISHED" : "DRAFT";
}

export async function createEvent(
  tx: Tx,
  input: EventInput,
): Promise<ServiceResult<{ id: string }>> {
  const { intent, ...fields } = input;
  const publishStatus = publishFor(intent);
  const event = await tx.event.create({
    data: { ...fields, publishStatus },
    select: { id: true },
  });
  return {
    entityId: event.id,
    metadata: { publishStatus, status: fields.status },
    data: { id: event.id },
  };
}

export async function updateEvent(
  tx: Tx,
  input: UpdateEventInput,
): Promise<ServiceResult> {
  const { id, intent, ...fields } = input;
  const existing = await tx.event.findUniqueOrThrow({ where: { id } });
  const publishStatus = publishFor(intent);
  const data = { ...fields, publishStatus };
  await tx.event.update({ where: { id }, data });
  return {
    entityId: id,
    metadata: {
      changed: changedFields(existing, data),
      ...(existing.publishStatus !== publishStatus
        ? { publishStatus: { from: existing.publishStatus, to: publishStatus } }
        : {}),
      ...(existing.status !== fields.status
        ? { status: { from: existing.status, to: fields.status } }
        : {}),
    },
  };
}

/** Visibility only (publishStatus); the lifecycle status is edited in the form. */
export async function setEventPublishStatus(
  tx: Tx,
  input: EventPublishInput,
): Promise<ServiceResult> {
  const existing = await tx.event.findUniqueOrThrow({
    where: { id: input.id },
    select: { publishStatus: true },
  });
  await tx.event.update({
    where: { id: input.id },
    data: { publishStatus: input.status },
  });
  return {
    entityId: input.id,
    metadata: {
      publishStatus: { from: existing.publishStatus, to: input.status },
    },
  };
}

export async function deleteEvent(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const event = await tx.event.delete({
    where: { id: input.id },
    select: { id: true, slug: true },
  });
  return { entityId: event.id, metadata: { slug: event.slug } };
}

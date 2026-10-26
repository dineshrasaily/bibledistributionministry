import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  MessageKind,
  MessageStatus,
  PrayerStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import type {
  MessageStatusInput,
  PrayerStatusInput,
} from "@/lib/validation/inbox";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import { requireAdmin } from "@/server/auth/guards";
import { ilike, paginate, type ServiceResult, type Tx } from "./shared";

/**
 * Private inbox (prayer requests, contact messages). The ONLY module that
 * touches these tables, and every exported function calls requireAdmin()
 * itself (defence in depth). Audit metadata never contains body, name or
 * email.
 */

export type PrayerListQuery = {
  q?: string;
  page: number;
  status?: PrayerStatus;
};

export type MessageListQuery = {
  q?: string;
  page: number;
  status?: MessageStatus;
  kind?: MessageKind;
};

export async function listPrayerRequests(query: PrayerListQuery) {
  await requireAdmin();
  const where: Prisma.PrayerRequestWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? { OR: [{ name: ilike(query.q) }, { body: ilike(query.q) }] }
      : {}),
  };
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.prayerRequest.count({ where }),
    ({ skip, take }) =>
      prisma.prayerRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

export async function getPrayerRequest(id: string) {
  await requireAdmin();
  return prisma.prayerRequest.findUnique({ where: { id } });
}

export async function listContactMessages(query: MessageListQuery) {
  await requireAdmin();
  const where: Prisma.ContactMessageWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.q
      ? {
          OR: [
            { name: ilike(query.q) },
            { subject: ilike(query.q) },
            { body: ilike(query.q) },
          ],
        }
      : {}),
  };
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.contactMessage.count({ where }),
    ({ skip, take }) =>
      prisma.contactMessage.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

export async function getContactMessage(id: string) {
  await requireAdmin();
  return prisma.contactMessage.findUnique({ where: { id } });
}

export async function countNewInbox(): Promise<{
  prayer: number;
  messages: number;
}> {
  await requireAdmin();
  const [prayer, messages] = await Promise.all([
    prisma.prayerRequest.count({ where: { status: "NEW" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);
  return { prayer, messages };
}

export async function setPrayerStatus(
  tx: Tx,
  input: PrayerStatusInput,
): Promise<ServiceResult> {
  await requireAdmin();
  const before = await tx.prayerRequest.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true },
  });
  await tx.prayerRequest.update({
    where: { id: input.id },
    data: { status: input.status },
  });
  return {
    entityId: input.id,
    metadata: { status: { from: before.status, to: input.status } },
  };
}

export async function setMessageStatus(
  tx: Tx,
  input: MessageStatusInput,
): Promise<ServiceResult> {
  await requireAdmin();
  const before = await tx.contactMessage.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true },
  });
  await tx.contactMessage.update({
    where: { id: input.id },
    data: { status: input.status },
  });
  return {
    entityId: input.id,
    metadata: { status: { from: before.status, to: input.status } },
  };
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  MessageKind,
  MessageStatus,
  PrayerStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { findPersonalInfo, type PersonalInfoKind } from "@/lib/pii";
import { retentionCutoff } from "@/lib/retention";
import {
  type InboxNoteInput,
  type MessageStatusInput,
  NO_CONSENT_MSG,
  NOT_TESTIMONY_MSG,
  type PrayerStatusInput,
  type PublishShareInput,
} from "@/lib/validation/inbox";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import {
  type AdminActor,
  AuthzError,
  requireAdmin,
} from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { FORM_ATTEMPT_TTL_MS } from "@/server/forms/rate-limit";
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
        include: { publicShare: { select: { id: true } } },
      }),
  );
}

const shareSelect = {
  select: { id: true, textEn: true, textNe: true, publishedAt: true },
} as const;

export async function getPrayerRequest(id: string) {
  await requireAdmin();
  return prisma.prayerRequest.findUnique({
    where: { id },
    include: { publicShare: shareSelect },
  });
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
        include: { publicShare: { select: { id: true } } },
      }),
  );
}

export async function getContactMessage(id: string) {
  await requireAdmin();
  return prisma.contactMessage.findUnique({
    where: { id },
    include: { publicShare: shareSelect },
  });
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

// ---------- notes ----------

export async function setPrayerNote(
  tx: Tx,
  input: InboxNoteInput,
): Promise<ServiceResult> {
  await requireAdmin();
  await tx.prayerRequest.update({
    where: { id: input.id },
    data: { adminNote: input.adminNote },
    select: { id: true },
  });
  return {
    entityId: input.id,
    metadata: { noteChanged: true, length: input.adminNote?.length ?? 0 },
  };
}

export async function setMessageNote(
  tx: Tx,
  input: InboxNoteInput,
): Promise<ServiceResult> {
  await requireAdmin();
  await tx.contactMessage.update({
    where: { id: input.id },
    data: { adminNote: input.adminNote },
    select: { id: true },
  });
  return {
    entityId: input.id,
    metadata: { noteChanged: true, length: input.adminNote?.length ?? 0 },
  };
}

// ---------- delete ----------

export async function deletePrayerRequest(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  await requireAdmin();
  const row = await tx.prayerRequest.findUniqueOrThrow({
    where: { id: input.id },
    select: { publicShare: { select: { id: true } } },
  });
  // The PublicShare (if any) cascades.
  await tx.prayerRequest.delete({ where: { id: input.id } });
  return {
    entityId: input.id,
    metadata: { hadPublicShare: !!row.publicShare },
  };
}

export async function deleteContactMessage(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  await requireAdmin();
  const row = await tx.contactMessage.findUniqueOrThrow({
    where: { id: input.id },
    select: { publicShare: { select: { id: true } } },
  });
  await tx.contactMessage.delete({ where: { id: input.id } });
  return {
    entityId: input.id,
    metadata: { hadPublicShare: !!row.publicShare },
  };
}

// ---------- publish (consent only) ----------

const PII_LABELS: Record<PersonalInfoKind, string> = {
  email: "an email address",
  phone: "a phone number",
  name: "the sender's name",
};

/** Rejects public text that still contains obvious personal information. */
function assertNoPersonalInfo(
  input: PublishShareInput,
  submitter: { name: string | null; email: string | null },
): void {
  for (const field of ["textEn", "textNe"] as const) {
    const text = input[field];
    if (!text) continue;
    const found = findPersonalInfo(text, submitter);
    if (found.length > 0) {
      const what = found.map((k) => PII_LABELS[k]).join(", ");
      throw new DomainError(
        "VALIDATION",
        `The public text still contains ${what}. Remove it before publishing.`,
        field,
      );
    }
  }
}

export async function publishPrayer(
  tx: Tx,
  input: PublishShareInput,
  actor: AdminActor,
): Promise<ServiceResult> {
  await requireAdmin();
  const row = await tx.prayerRequest.findUniqueOrThrow({
    where: { id: input.id },
    select: {
      shareConsent: true,
      name: true,
      email: true,
      publicShare: { select: { id: true } },
    },
  });
  if (!row.shareConsent) throw new DomainError("CONFLICT", NO_CONSENT_MSG);
  assertNoPersonalInfo(input, row);
  const data = {
    textEn: input.textEn,
    textNe: input.textNe,
    publishedById: actor.id,
  };
  await tx.publicShare.upsert({
    where: { prayerRequestId: input.id },
    create: { kind: "PRAYER", prayerRequestId: input.id, ...data },
    update: data,
  });
  return {
    entityId: input.id,
    metadata: { kind: "PRAYER", updated: !!row.publicShare },
  };
}

export async function publishTestimony(
  tx: Tx,
  input: PublishShareInput,
  actor: AdminActor,
): Promise<ServiceResult> {
  await requireAdmin();
  const row = await tx.contactMessage.findUniqueOrThrow({
    where: { id: input.id },
    select: {
      kind: true,
      shareConsent: true,
      name: true,
      email: true,
      publicShare: { select: { id: true } },
    },
  });
  if (row.kind !== "TESTIMONY") {
    throw new DomainError("CONFLICT", NOT_TESTIMONY_MSG);
  }
  if (!row.shareConsent) throw new DomainError("CONFLICT", NO_CONSENT_MSG);
  assertNoPersonalInfo(input, row);
  const data = {
    textEn: input.textEn,
    textNe: input.textNe,
    publishedById: actor.id,
  };
  await tx.publicShare.upsert({
    where: { contactMessageId: input.id },
    create: { kind: "TESTIMONY", contactMessageId: input.id, ...data },
    update: data,
  });
  return {
    entityId: input.id,
    metadata: { kind: "TESTIMONY", updated: !!row.publicShare },
  };
}

export async function unpublishPrayer(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  await requireAdmin();
  const { count } = await tx.publicShare.deleteMany({
    where: { prayerRequestId: input.id },
  });
  return { entityId: input.id, metadata: { removed: count } };
}

export async function unpublishTestimony(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  await requireAdmin();
  const { count } = await tx.publicShare.deleteMany({
    where: { contactMessageId: input.id },
  });
  return { entityId: input.id, metadata: { removed: count } };
}

// ---------- retention purge (OWNER via the action role) ----------

export type PurgePreview = {
  months: number;
  cutoff: Date;
  prayer: number;
  messages: number;
  lastPurgeAt: Date | null;
};

async function retentionMonthsOf(db: Tx): Promise<number> {
  const row = await db.siteSettings.findUnique({
    where: { id: "singleton" },
    select: { inboxRetentionMonths: true },
  });
  return row?.inboxRetentionMonths ?? 12;
}

/** Counts only: what "Delete old items" would remove right now. */
export async function previewPurge(now = new Date()): Promise<PurgePreview> {
  await requireAdmin();
  const months = await retentionMonthsOf(prisma);
  const cutoff = retentionCutoff(now, months);
  const where = { createdAt: { lt: cutoff } };
  const [prayer, messages, last] = await Promise.all([
    prisma.prayerRequest.count({ where }),
    prisma.contactMessage.count({ where }),
    prisma.auditLog.findFirst({
      where: { action: "inbox.purge" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    months,
    cutoff,
    prayer,
    messages,
    lastPurgeAt: last?.createdAt ?? null,
  };
}

export async function purgeOldInbox(
  tx: Tx,
): Promise<ServiceResult<{ prayerDeleted: number; messagesDeleted: number }>> {
  const actor = await requireAdmin();
  // Bulk delete: OWNER only (the action role checks this too).
  if (actor.role !== "OWNER") throw new AuthzError("FORBIDDEN");
  const now = new Date();
  const months = await retentionMonthsOf(tx);
  const cutoff = retentionCutoff(now, months);
  const where = { createdAt: { lt: cutoff } };
  const sharesDeleted = await tx.publicShare.count({
    where: {
      OR: [{ prayerRequest: where }, { contactMessage: where }],
    },
  });
  const prayer = await tx.prayerRequest.deleteMany({ where });
  const messages = await tx.contactMessage.deleteMany({ where });
  await tx.formSubmissionAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - FORM_ATTEMPT_TTL_MS) } },
  });
  return {
    entityId: null,
    metadata: {
      months,
      cutoff: cutoff.toISOString(),
      prayerDeleted: prayer.count,
      messagesDeleted: messages.count,
      sharesDeleted,
    },
    data: { prayerDeleted: prayer.count, messagesDeleted: messages.count },
  };
}

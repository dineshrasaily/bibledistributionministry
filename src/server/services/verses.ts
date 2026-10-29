import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { BibleTranslation, ContentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getVerseOfTheDay, siteDay } from "@/lib/verse-of-the-day";
import { PAGE_SIZE } from "@/lib/validation/list-query";
import type {
  FeatureVerseInput,
  UpdateVerseInput,
  VerseInput,
  VerseStatusInput,
} from "@/lib/validation/verses";
import { DomainError } from "@/server/errors";
import { getSettingsForEdit } from "./settings";
import {
  changedFields,
  ilike,
  paginate,
  type ServiceResult,
  type Tx,
} from "./shared";

export const FEATURE_DRAFT_MSG = "Publish this verse before featuring it.";

export type VerseListQuery = {
  q?: string;
  page: number;
  status?: ContentStatus;
};

export function listVerses(query: VerseListQuery) {
  const where: Prisma.BibleVerseWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? { OR: [{ reference: ilike(query.q) }, { text: ilike(query.q) }] }
      : {}),
  };
  return paginate(
    query.page,
    PAGE_SIZE,
    () => prisma.bibleVerse.count({ where }),
    ({ skip, take }) =>
      prisma.bibleVerse.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
  );
}

export function getVerse(id: string) {
  return prisma.bibleVerse.findUnique({ where: { id } });
}

/** UTC midnight of `now` (kept for callers that want the UTC date). */
export function utcDay(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Today in the Settings time zone (the verse-of-the-day boundary). */
export async function siteToday(now: Date = new Date()) {
  const settings = await getSettingsForEdit();
  return {
    ...siteDay(now, settings.siteTimezone),
    timeZone: settings.siteTimezone,
  };
}

/** The verse featured exactly on `day` (default: today in the site time zone). */
export async function getVerseFeaturedOn(day?: Date) {
  const key = day ?? (await siteToday()).utcDate;
  return prisma.bibleVerse.findUnique({ where: { featuredOn: key } });
}

export type TodayVersePreview = {
  /** "YYYY-MM-DD" in the site time zone. */
  today: string;
  timeZone: string;
  /** A published verse featured today: visitors see it instead of the automatic one. */
  override: { reference: string; translation: BibleTranslation } | null;
  autoEnabled: boolean;
  auto: { reference: string; translation: BibleTranslation };
};

/** What visitors see today (read-only preview for Admin -> Bible verses). */
export async function getTodayVersePreview(
  now: Date = new Date(),
): Promise<TodayVersePreview> {
  const settings = await getSettingsForEdit();
  const day = siteDay(now, settings.siteTimezone);
  const featured = await prisma.bibleVerse.findFirst({
    where: { status: "PUBLISHED", featuredOn: day.utcDate },
    select: { reference: true, translation: true },
  });
  const { verse } = getVerseOfTheDay(now, settings.siteTimezone);
  return {
    today: day.iso,
    timeZone: settings.siteTimezone,
    override: featured,
    autoEnabled: settings.autoVerseEnabled,
    auto: {
      reference: verse.reference,
      translation: settings.autoVerseTranslation,
    },
  };
}

function statusFor(intent: VerseInput["intent"]): ContentStatus {
  return intent === "publish" ? "PUBLISHED" : "DRAFT";
}

function assertFeaturable(status: ContentStatus, featuredOn: Date | null) {
  if (featuredOn && status !== "PUBLISHED") {
    throw new DomainError("VALIDATION", FEATURE_DRAFT_MSG, "featuredOn");
  }
}

export async function createVerse(
  tx: Tx,
  input: VerseInput,
): Promise<ServiceResult<{ id: string }>> {
  const { intent, ...fields } = input;
  const status = statusFor(intent);
  assertFeaturable(status, fields.featuredOn);
  const verse = await tx.bibleVerse.create({
    data: { ...fields, status },
    select: { id: true },
  });
  return { entityId: verse.id, metadata: { status }, data: { id: verse.id } };
}

export async function updateVerse(
  tx: Tx,
  input: UpdateVerseInput,
): Promise<ServiceResult> {
  const { id, intent, ...fields } = input;
  const existing = await tx.bibleVerse.findUniqueOrThrow({ where: { id } });
  const status = statusFor(intent);
  assertFeaturable(status, fields.featuredOn);
  const data = { ...fields, status };
  await tx.bibleVerse.update({ where: { id }, data });
  return {
    entityId: id,
    metadata: {
      changed: changedFields(existing, data),
      ...(existing.status !== status
        ? { status: { from: existing.status, to: status } }
        : {}),
    },
  };
}

export async function setVerseStatus(
  tx: Tx,
  input: VerseStatusInput,
): Promise<ServiceResult> {
  const existing = await tx.bibleVerse.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true },
  });
  await tx.bibleVerse.update({
    where: { id: input.id },
    data: { status: input.status },
  });
  return {
    entityId: input.id,
    metadata: { status: { from: existing.status, to: input.status } },
  };
}

/** Moves the "verse of the day" for `date` to this verse (unique backstop: P2002). */
export async function setFeaturedVerse(
  tx: Tx,
  input: FeatureVerseInput,
): Promise<ServiceResult> {
  const verse = await tx.bibleVerse.findUniqueOrThrow({
    where: { id: input.id },
    select: { status: true, featuredOn: true },
  });
  if (verse.status !== "PUBLISHED") {
    throw new DomainError("VALIDATION", FEATURE_DRAFT_MSG, "date");
  }
  const cleared = await tx.bibleVerse.updateMany({
    where: { featuredOn: input.date, NOT: { id: input.id } },
    data: { featuredOn: null },
  });
  await tx.bibleVerse.update({
    where: { id: input.id },
    data: { featuredOn: input.date },
  });
  return {
    entityId: input.id,
    metadata: {
      featuredOn: input.date.toISOString().slice(0, 10),
      previous: verse.featuredOn?.toISOString().slice(0, 10) ?? null,
      replaced: cleared.count,
    },
  };
}

export async function clearFeaturedVerse(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const verse = await tx.bibleVerse.findUniqueOrThrow({
    where: { id: input.id },
    select: { featuredOn: true },
  });
  await tx.bibleVerse.update({
    where: { id: input.id },
    data: { featuredOn: null },
  });
  return {
    entityId: input.id,
    metadata: {
      previous: verse.featuredOn?.toISOString().slice(0, 10) ?? null,
    },
  };
}

export async function deleteVerse(
  tx: Tx,
  input: { id: string },
): Promise<ServiceResult> {
  const verse = await tx.bibleVerse.delete({
    where: { id: input.id },
    select: { id: true, reference: true },
  });
  return { entityId: verse.id, metadata: { reference: verse.reference } };
}

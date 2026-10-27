/**
 * Raw inbox reads/writes for DB tests. Tests must not use the private inbox
 * delegates directly (privacy scan); they go through these helpers.
 */
import { prisma } from "@/lib/db";

export const allPrayerRows = () =>
  prisma.prayerRequest.findMany({ orderBy: { createdAt: "asc" } });

export const allMessageRows = () =>
  prisma.contactMessage.findMany({ orderBy: { createdAt: "asc" } });

export const allAttemptRows = () =>
  prisma.formSubmissionAttempt.findMany({ orderBy: { createdAt: "asc" } });

export const allPublicShares = () =>
  prisma.publicShare.findMany({ orderBy: { publishedAt: "asc" } });

export const findPrayerRow = (id: string) =>
  prisma.prayerRequest.findUnique({ where: { id } });

export const findMessageRow = (id: string) =>
  prisma.contactMessage.findUnique({ where: { id } });

/** Moves every attempt row `ms` into the past. */
export async function backdateAttempts(ms: number): Promise<void> {
  const rows = await allAttemptRows();
  for (const row of rows) {
    await prisma.formSubmissionAttempt.update({
      where: { id: row.id },
      data: { createdAt: new Date(row.createdAt.getTime() - ms) },
    });
  }
}

export function makeAttempt(createdAt: Date, ipHash = "0".repeat(64)) {
  return prisma.formSubmissionAttempt.create({
    data: { form: "PRAYER", ipHash, createdAt },
  });
}

export function makePublicShare(data: {
  kind: "PRAYER" | "TESTIMONY";
  textEn?: string | null;
  textNe?: string | null;
  prayerRequestId?: string;
  contactMessageId?: string;
  publishedAt?: Date;
}) {
  return prisma.publicShare.create({ data });
}

/**
 * Per-account credential attempt budget (5 failures, then a 15 minute lock).
 * Every check is an atomic write so concurrent requests cannot exceed the
 * budget. Pure module: each function takes a Prisma client/transaction.
 */
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient | Prisma.TransactionClient;

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

/**
 * Reserves one attempt before any password/TOTP work. Returns the new
 * `failedLoginCount`, or null when the account is inactive or locked.
 */
export async function reserveCredentialAttempt(
  db: Db,
  userId: string,
  now: Date,
): Promise<number | null> {
  // Columns are UTC `timestamp(3)`: compare against UTC wall time explicitly.
  const rows = await db.$queryRaw<{ failedLoginCount: number }[]>`
    UPDATE "AdminUser" SET "failedLoginCount" = "failedLoginCount" + 1
    WHERE id = ${userId} AND "isActive" = true
      AND ("lockedUntil" IS NULL OR "lockedUntil" <= (${now.toISOString()}::timestamptz AT TIME ZONE 'UTC'))
    RETURNING "failedLoginCount"`;
  const count = rows[0]?.failedLoginCount;
  return count == null ? null : Number(count);
}

/** Gives back a reservation (correct password): never below 0. */
export async function refundCredentialAttempt(
  db: Db,
  userId: string,
): Promise<void> {
  await db.$executeRaw`
    UPDATE "AdminUser" SET "failedLoginCount" = GREATEST("failedLoginCount" - 1, 0)
    WHERE id = ${userId}`;
}

/**
 * Locks the account for 15 minutes and resets the counter. Only the caller
 * that actually applies the lock writes the `auth.lockout` audit row.
 */
export async function applyLock(
  db: PrismaClient,
  userId: string,
  now: Date,
  opts: { bumpSessionVersion?: boolean } = {},
): Promise<{ locked: true; newlyLocked: boolean }> {
  const lockedUntil = new Date(now.getTime() + LOCK_MS);
  return db.$transaction(async (tx) => {
    const result = await tx.adminUser.updateMany({
      where: {
        id: userId,
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
      },
      data: {
        lockedUntil,
        failedLoginCount: 0,
        ...(opts.bumpSessionVersion
          ? { sessionVersion: { increment: 1 } }
          : {}),
      },
    });
    const newlyLocked = result.count === 1;
    if (newlyLocked) {
      const user = await tx.adminUser.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorEmail: user?.email ?? null,
          action: "auth.lockout",
          entityType: "AdminUser",
          entityId: userId,
          metadata: { lockedUntil: lockedUntil.toISOString() },
        },
      });
    }
    return { locked: true as const, newlyLocked };
  });
}

import "server-only";
import type { FormKind } from "@/generated/prisma/enums";
import type { Db } from "@/server/auth/lockout";

export const FORM_WINDOW_MS = 60 * 60 * 1000;
/** Attempt rows are kept only this long (privacy policy: "a short time"). */
export const FORM_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Insert-then-count per (form, ipHash) in a rolling hour. The attempt row is
 * committed before counting, so parallel requests cannot all slip through.
 * Old attempt rows are deleted on the way.
 */
export async function reserveFormSubmission(
  db: Db,
  {
    form,
    ipHash,
    now,
    limit,
  }: { form: FormKind; ipHash: string; now: Date; limit: number },
): Promise<{ limited: boolean }> {
  await db.formSubmissionAttempt.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - FORM_ATTEMPT_TTL_MS) } },
  });
  await db.formSubmissionAttempt.create({
    data: { form, ipHash, createdAt: now },
    select: { id: true },
  });
  const count = await db.formSubmissionAttempt.count({
    where: {
      form,
      ipHash,
      createdAt: { gt: new Date(now.getTime() - FORM_WINDOW_MS) },
    },
  });
  return { limited: count > limit };
}

import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Interactive transaction client passed to every mutating service. */
export type Tx = Prisma.TransactionClient;

/** What a mutating service returns to runAdminAction (audit row + result data). */
export type ServiceResult<T = undefined> = {
  entityId: string | null;
  metadata?: Prisma.InputJsonValue;
  data?: T;
};

export { ilike, paginate, type Page } from "@/lib/pagination";

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return (a ?? null) === (b ?? null);
}

/** Names of the fields in `next` whose values differ from `before`. */
export function changedFields(
  before: Record<string, unknown> | null,
  next: Record<string, unknown>,
): string[] {
  return Object.keys(next).filter((key) => !same(before?.[key], next[key]));
}

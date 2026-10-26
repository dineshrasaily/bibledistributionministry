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

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** Runs count + findMany for one page (page is clamped to the last page). */
export async function paginate<T>(
  page: number,
  pageSize: number,
  count: () => Promise<number>,
  find: (args: { skip: number; take: number }) => Promise<T[]>,
): Promise<Page<T>> {
  const total = await count();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const items = await find({ skip: (current - 1) * pageSize, take: pageSize });
  return { items, total, page: current, pageSize, pageCount };
}

/** Case-insensitive `contains` for list search. */
export const ilike = (q: string) => ({
  contains: q,
  mode: "insensitive" as const,
});

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

/**
 * Pagination helpers shared by admin services and public reads.
 * Pure module (no DB import; callers pass the queries).
 */

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

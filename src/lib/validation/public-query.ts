/**
 * Public Devotionals list `searchParams` (q, type, category, page). Lenient
 * like the admin list query: invalid values are dropped, it never throws.
 * Pure module.
 */
import { z } from "zod";
import { PostType } from "@/generated/prisma/enums";
import { SLUG_RE } from "./common";

export const PUBLIC_POST_PAGE_SIZE = 9;

export type PublicPostQuery = {
  q?: string;
  type?: PostType;
  /** Category slug. */
  category?: string;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const qSchema = z.preprocess(
  first,
  z
    .string()
    .trim()
    .max(100)
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .catch(undefined),
);

const typeSchema = z.preprocess(
  first,
  z.enum(PostType).optional().catch(undefined),
);

const categorySchema = z.preprocess(
  first,
  z.string().trim().max(120).regex(SLUG_RE).optional().catch(undefined),
);

const pageSchema = z.preprocess(
  first,
  z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
);

const schema = z.object({
  q: qSchema,
  type: typeSchema,
  category: categorySchema,
  page: pageSchema,
});

/** Parses Next's `searchParams` object; never throws. */
export function parsePublicPostQuery(
  searchParams: SearchParams,
): PublicPostQuery {
  const result = schema.safeParse(searchParams);
  if (!result.success) return { page: 1 };
  const { q, type, category, page } = result.data;
  return {
    ...(q ? { q } : {}),
    ...(type ? { type } : {}),
    ...(category ? { category } : {}),
    page,
  };
}

/** True when any filter (not just the page) is active. */
export function hasPublicPostFilters(query: PublicPostQuery): boolean {
  return Boolean(query.q || query.type || query.category);
}

/**
 * `base?q=&type=&category=&page=` with empty params omitted (page 1 is
 * omitted too). Changing a filter resets the page unless `page` is given.
 */
export function publicPostQueryHref(
  base: string,
  query: PublicPostQuery,
  overrides: Partial<PublicPostQuery> = {},
): string {
  const filterChanged = (["q", "type", "category"] as const).some(
    (key) => key in overrides && overrides[key] !== query[key],
  );
  const merged: PublicPostQuery = {
    ...query,
    ...overrides,
    page: overrides.page ?? (filterChanged ? 1 : query.page),
  };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.type) params.set("type", merged.type);
  if (merged.category) params.set("category", merged.category);
  if (merged.page > 1) params.set("page", String(merged.page));
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

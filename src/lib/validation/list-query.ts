/**
 * Admin list `searchParams`: lenient by design (invalid values fall back to
 * defaults instead of erroring).
 */
import { z } from "zod";

export const PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 50;

type EnumValues = Readonly<Record<string, string>>;
type Filters = {
  type?: EnumValues;
  status?: EnumValues;
  kind?: EnumValues;
  category?: EnumValues;
  source?: EnumValues;
};

export type ListQuery<F extends Filters = Filters> = {
  q?: string;
  page: number;
} & { [K in keyof F]?: F[K] extends EnumValues ? F[K][keyof F[K]] : never };

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

const pageSchema = z.preprocess(
  first,
  z.coerce.number().int().min(1).catch(1).default(1),
);

function enumFilter(values: EnumValues) {
  return z.preprocess(
    first,
    z
      .enum(values as Record<string, string>)
      .optional()
      .catch(undefined),
  );
}

/** Builds the schema for one list page's filters. */
export function listQuerySchema<F extends Filters>(filters: F = {} as F) {
  const shape: Record<string, z.ZodType> = { q: qSchema, page: pageSchema };
  for (const [key, values] of Object.entries(filters)) {
    if (values) shape[key] = enumFilter(values);
  }
  return z.object(shape) as unknown as z.ZodType<ListQuery<F>>;
}

/** Parses Next's `searchParams` object; never throws. */
export function parseListQuery<F extends Filters>(
  searchParams: Record<string, string | string[] | undefined>,
  filters: F = {} as F,
): ListQuery<F> {
  const result = listQuerySchema(filters).safeParse(searchParams);
  return result.success ? result.data : ({ page: 1 } as ListQuery<F>);
}

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import type { PublicPostQuery } from "@/lib/validation/public-query";

export type PostFilterLabels = {
  heading: string;
  search: string;
  searchPlaceholder: string;
  type: string;
  allTypes: string;
  category: string;
  allCategories: string;
  apply: string;
  clear: string;
};

/**
 * Plain GET form (works without JavaScript). Submitting resets the page
 * because `page` is not part of the form.
 */
export function PostFilters({
  action,
  query,
  types,
  categories,
  labels,
}: {
  /** Localized list path, e.g. "/ne/devotionals". */
  action: string;
  query: PublicPostQuery;
  types: { value: string; label: string }[];
  categories: { value: string; label: string }[];
  labels: PostFilterLabels;
}) {
  const active = Boolean(query.q || query.type || query.category);
  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-labelledby="post-filters-heading"
      className="rounded-lg border border-beige bg-white p-5 shadow-[0_1px_2px_rgba(20,28,47,0.04)] sm:p-6"
    >
      <h2
        id="post-filters-heading"
        className="mb-4 font-sans text-sm font-semibold tracking-[0.16em] text-gold-dark uppercase"
      >
        {labels.heading}
      </h2>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Label htmlFor="filter-q">{labels.search}</Label>
          <Input
            id="filter-q"
            type="search"
            name="q"
            maxLength={100}
            defaultValue={query.q ?? ""}
            placeholder={labels.searchPlaceholder}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="filter-type">{labels.type}</Label>
          <Select
            id="filter-type"
            name="type"
            defaultValue={query.type ?? ""}
            className="mt-1.5"
          >
            <option value="">{labels.allTypes}</option>
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-category">{labels.category}</Label>
          <Select
            id="filter-category"
            name="category"
            defaultValue={query.category ?? ""}
            className="mt-1.5"
          >
            <option value="">{labels.allCategories}</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button type="submit">{labels.apply}</Button>
        {active ? (
          <Link
            href={action}
            className="rounded-sm text-sm font-semibold text-navy underline decoration-gold underline-offset-4 hover:decoration-2"
          >
            {labels.clear}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

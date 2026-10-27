import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  publicPostQueryHref,
  type PublicPostQuery,
} from "@/lib/validation/public-query";

export type PaginationLabels = {
  label: string;
  previous: string;
  next: string;
  /** e.g. "Page 2 of 3". */
  pageOf: string;
};

/** Page numbers to show: all when few, else first/last around a window. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out.at(-1);
    if (typeof prev === "number" && p - prev > 1) out.push(null);
    out.push(p);
  }
  return out;
}

const itemClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-4 text-sm font-medium";

/** Server-rendered Previous / page numbers / Next that keep the filters. */
export function PublicPagination({
  base,
  query,
  page,
  pageCount,
  labels,
}: {
  /** Localized list path, e.g. "/en/devotionals". */
  base: string;
  query: PublicPostQuery;
  page: number;
  pageCount: number;
  labels: PaginationLabels;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => publicPostQueryHref(base, query, { page: p });

  return (
    <nav aria-label={labels.label} className="flex flex-col items-center gap-3">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              rel="prev"
              className={cn(
                itemClass,
                "border border-navy text-navy hover:bg-navy/5",
              )}
            >
              <span aria-hidden="true">←&nbsp;</span>
              {labels.previous}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClass, "border border-navy/20 text-navy/70")}
            >
              <span aria-hidden="true">←&nbsp;</span>
              {labels.previous}
            </span>
          )}
        </li>
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  itemClass,
                  p === page
                    ? "bg-navy text-white"
                    : "text-navy hover:bg-beige/60",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link
              href={href(page + 1)}
              rel="next"
              className={cn(
                itemClass,
                "border border-navy text-navy hover:bg-navy/5",
              )}
            >
              {labels.next}
              <span aria-hidden="true">&nbsp;→</span>
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className={cn(itemClass, "border border-navy/20 text-navy/70")}
            >
              {labels.next}
              <span aria-hidden="true">&nbsp;→</span>
            </span>
          )}
        </li>
      </ul>
      <p className="text-sm text-navy/75">{labels.pageOf}</p>
    </nav>
  );
}

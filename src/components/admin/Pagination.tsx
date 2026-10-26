import Link from "next/link";
import { cn } from "@/lib/cn";

type Query = Record<string, string | number | undefined | null>;

/** Builds `path?k=v` keeping only non-empty values. */
export function hrefWith(path: string, query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

const linkClass =
  "inline-flex min-h-11 items-center rounded-full border border-navy px-4 text-sm font-medium text-navy transition-colors hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark";

/** Prev/next links + "Page X of Y"; keeps the current filters. */
export function Pagination({
  path,
  query,
  page,
  pageCount,
}: {
  path: string;
  query: Query;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Link
          href={hrefWith(path, { ...query, page: page - 1 })}
          className={linkClass}
          rel="prev"
        >
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(linkClass, "invisible")}>
          Previous
        </span>
      )}
      <p className="text-sm text-navy/80">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link
          href={hrefWith(path, { ...query, page: page + 1 })}
          className={linkClass}
          rel="next"
        >
          Next
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(linkClass, "invisible")}>
          Next
        </span>
      )}
    </nav>
  );
}

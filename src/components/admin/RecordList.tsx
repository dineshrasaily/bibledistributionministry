import Link from "next/link";
import type { ReactNode } from "react";

export type RecordRow = {
  id: string;
  title: string;
  href: string;
  /** Status / type badges. */
  badges?: ReactNode;
  /** Secondary line, e.g. "Updated 3 Jan 2026". */
  meta?: ReactNode;
  /** Row actions (publish toggle, delete). */
  actions?: ReactNode;
};

/**
 * Semantic list of row cards: stacked on mobile, columns at md+. One DOM for
 * every width, so there is never horizontal scrolling.
 */
export function RecordList({
  rows,
  label,
}: {
  rows: RecordRow[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 rounded-lg border border-beige bg-white p-4 md:flex-row md:items-center md:gap-6"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Link
              href={row.href}
              className="font-serif text-lg font-semibold break-words text-navy underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
            >
              {row.title}
            </Link>
            {row.badges ? (
              <div className="flex flex-wrap items-center gap-2">
                {row.badges}
              </div>
            ) : null}
            {row.meta ? (
              <div className="text-sm text-navy/75">{row.meta}</div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Link
              href={row.href}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-navy underline underline-offset-2 hover:bg-beige/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-dark"
            >
              Edit<span className="sr-only"> {row.title}</span>
            </Link>
            {row.actions}
          </div>
        </li>
      ))}
    </ul>
  );
}

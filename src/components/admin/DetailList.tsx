import type { ReactNode } from "react";

/** Label/value pairs for inbox detail pages. */
export function DetailList({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-sm font-semibold text-navy">{item.label}</dt>
          <dd className="min-w-0 break-words text-navy/85">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

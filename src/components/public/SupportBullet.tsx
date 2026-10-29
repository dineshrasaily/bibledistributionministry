import type { ReactNode } from "react";

/** Inline link style used in the Support page disclosures. */
export const supportLinkClass =
  "font-medium text-navy underline decoration-gold-dark underline-offset-2 hover:decoration-2";

/** A gold-dot list item used in the Support page disclosures. */
export function SupportBullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-navy/85">
      <span
        aria-hidden="true"
        className="mt-2 size-2 shrink-0 rounded-full bg-gold-dark"
      />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

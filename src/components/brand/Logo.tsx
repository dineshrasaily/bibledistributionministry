import { cn } from "@/lib/cn";

/**
 * Placeholder mark: a slender navy cross in front of a gold ring of light.
 * Same motif as /public/logo.svg. Used as the fallback when no logo is set
 * in Settings (the app icons are generated from public/brand/logo-mark.png).
 */
export function Logo({
  label,
  decorative = false,
  className,
}: {
  /** Accessible name when the logo stands alone. */
  label?: string;
  /** Hide from assistive tech when visible text sits next to it. */
  decorative?: boolean;
  className?: string;
}) {
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-9 shrink-0", className)}
      focusable="false"
      {...a11y}
    >
      <circle cx="20" cy="17" r="11" fill="#EDE4D3" />
      <circle
        cx="20"
        cy="17"
        r="11"
        fill="none"
        stroke="#B8924A"
        strokeWidth="1.25"
      />
      <g stroke="#B8924A" strokeWidth="1.25" strokeLinecap="round">
        <path d="M20 2.5v2.5M7.5 8l1.8 1.6M32.5 8l-1.8 1.6M4.5 17h2.5M33 17h2.5" />
      </g>
      <rect x="18.4" y="6" width="3.2" height="30" rx="1" fill="#1E2A44" />
      <rect x="11.5" y="13" width="17" height="3.2" rx="1" fill="#1E2A44" />
    </svg>
  );
}
